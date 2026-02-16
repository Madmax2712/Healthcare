import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import {
  Hospital,
  HospitalSpecialist,
  Specialty,
  HospitalSearchParams,
  AvailabilityStatus,
  PaginationInfo,
} from '../../../shared/types';
import {
  DEFAULT_SEARCH_RADIUS_MILES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../../shared/constants';
import logger from '../utils/logger';

interface HospitalSearchResult {
  hospitals: (Hospital & { specialists_available?: number })[];
  pagination: PaginationInfo;
}

/**
 * Hospital service - manages hospital data, specialist availability,
 * and geographic search using PostgreSQL earth_distance functions.
 */
class HospitalService {
  /**
   * Search for nearby hospitals with optional specialty filtering.
   * Uses PostgreSQL earth_distance extension for geographic calculations.
   * Results are sorted by distance from the given coordinates.
   */
  async searchHospitals(params: HospitalSearchParams): Promise<HospitalSearchResult> {
    const {
      latitude,
      longitude,
      radius_miles = DEFAULT_SEARCH_RADIUS_MILES,
      specialty_id,
      available_now = false,
      emergency_only = false,
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
    } = params;

    const effectiveLimit = Math.min(limit, MAX_PAGE_SIZE);
    const offset = (page - 1) * effectiveLimit;

    // Convert miles to meters for earth_distance (1 mile = 1609.344 meters)
    const radiusMeters = radius_miles * 1609.344;

    let query = db('hospitals as h')
      .select(
        'h.*',
        db.raw(
          `(point(h.longitude, h.latitude) <@> point(?, ?)) * 1609.344 as distance_meters`,
          [longitude, latitude]
        ),
        db.raw(
          `(point(h.longitude, h.latitude) <@> point(?, ?)) as distance_miles`,
          [longitude, latitude]
        )
      )
      .whereRaw(
        `(point(h.longitude, h.latitude) <@> point(?, ?)) * 1609.344 <= ?`,
        [longitude, latitude, radiusMeters]
      );

    if (emergency_only) {
      query = query.where('h.emergency_services', true);
    }

    if (specialty_id) {
      query = query
        .join('hospital_specialists as hs', 'h.hospital_id', 'hs.hospital_id')
        .where('hs.specialty_id', specialty_id);

      if (available_now) {
        query = query
          .where('hs.is_available', true)
          .where('hs.availability_status', 'available');
      }

      query = query.groupBy('h.hospital_id');
    }

    // Count total results for pagination
    const countQuery = query.clone();
    const [{ count: totalCount }] = await countQuery.clearSelect().clearOrder().count('* as count');
    const total = parseInt(totalCount as string, 10);

    // Fetch paginated results sorted by distance
    const hospitals = await query
      .orderByRaw('distance_miles ASC')
      .limit(effectiveLimit)
      .offset(offset);

    // Attach available specialist count for each hospital
    const hospitalIds = hospitals.map((h: Hospital) => h.hospital_id);

    if (hospitalIds.length > 0) {
      const specialistCounts = await db('hospital_specialists')
        .select('hospital_id')
        .count('* as specialists_available')
        .where('is_available', true)
        .whereIn('hospital_id', hospitalIds)
        .groupBy('hospital_id');

      const countsMap = new Map(
        specialistCounts.map((sc: { hospital_id: string; specialists_available: string }) => [
          sc.hospital_id,
          parseInt(sc.specialists_available, 10),
        ])
      );

      for (const hospital of hospitals) {
        (hospital as Hospital & { specialists_available: number }).specialists_available =
          countsMap.get(hospital.hospital_id) || 0;
        // Round distance for cleaner output
        hospital.distance = Math.round(hospital.distance_miles * 100) / 100;
        delete hospital.distance_miles;
        delete hospital.distance_meters;
      }
    }

    return {
      hospitals,
      pagination: {
        page,
        limit: effectiveLimit,
        total,
        total_pages: Math.ceil(total / effectiveLimit),
      },
    };
  }

  /**
   * Get detailed information about a specific hospital.
   */
  async getHospitalById(hospitalId: string): Promise<Hospital | null> {
    const hospital = await db('hospitals')
      .where('hospital_id', hospitalId)
      .first();

    return hospital || null;
  }

  /**
   * Get all specialists for a given hospital, optionally filtered by specialty.
   */
  async getHospitalSpecialists(
    hospitalId: string,
    specialtyId?: string,
    availableOnly: boolean = false
  ): Promise<HospitalSpecialist[]> {
    let query = db('hospital_specialists as hs')
      .select('hs.*', 's.specialty_name', 's.specialty_code', 's.is_emergency')
      .join('specialties as s', 'hs.specialty_id', 's.specialty_id')
      .where('hs.hospital_id', hospitalId);

    if (specialtyId) {
      query = query.where('hs.specialty_id', specialtyId);
    }

    if (availableOnly) {
      query = query
        .where('hs.is_available', true)
        .where('hs.availability_status', 'available');
    }

    const specialists = await query.orderBy('s.display_order', 'asc');

    return specialists.map((spec: HospitalSpecialist & { specialty_name: string; specialty_code: string; is_emergency: boolean }) => ({
      ...spec,
      specialty: {
        specialty_id: spec.specialty_id,
        specialty_name: spec.specialty_name,
        specialty_code: spec.specialty_code,
        is_emergency: spec.is_emergency,
      } as Specialty,
    }));
  }

  /**
   * Get a specialist's current schedule.
   */
  async getSpecialistSchedule(specialistId: string) {
    return db('specialist_schedules')
      .where('specialist_id', specialistId)
      .where('is_active', true)
      .orderBy('day_of_week', 'asc');
  }

  /**
   * Update a specialist's availability status.
   */
  async updateSpecialistStatus(
    specialistId: string,
    status: AvailabilityStatus,
    nextAvailableSlot?: string
  ): Promise<HospitalSpecialist | null> {
    const [updated] = await db('hospital_specialists')
      .where('specialist_id', specialistId)
      .update({
        availability_status: status,
        is_available: status === 'available',
        next_available_slot: nextAvailableSlot || null,
        updated_at: new Date().toISOString(),
      })
      .returning('*');

    if (updated) {
      logger.info('Specialist status updated', {
        specialistId,
        status,
        hospitalId: updated.hospital_id,
      });
    }

    return updated || null;
  }

  /**
   * Update hospital details (admin only).
   */
  async updateHospital(
    hospitalId: string,
    updates: Partial<Hospital>
  ): Promise<Hospital | null> {
    // Prevent updating immutable fields
    const { hospital_id, created_at, ...safeUpdates } = updates as Hospital;

    const [updated] = await db('hospitals')
      .where('hospital_id', hospitalId)
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString(),
      })
      .returning('*');

    return updated || null;
  }

  /**
   * Add a new specialist to a hospital.
   */
  async addSpecialist(
    hospitalId: string,
    data: {
      specialty_id: string;
      doctor_name: string;
      license_number?: string;
      consultation_fee?: number;
      years_of_experience?: number;
    }
  ): Promise<HospitalSpecialist> {
    const specialistId = uuidv4();

    const [specialist] = await db('hospital_specialists')
      .insert({
        specialist_id: specialistId,
        hospital_id: hospitalId,
        specialty_id: data.specialty_id,
        doctor_name: data.doctor_name,
        license_number: data.license_number,
        consultation_fee: data.consultation_fee,
        years_of_experience: data.years_of_experience,
        is_available: false,
        availability_status: 'off_duty',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning('*');

    logger.info('Specialist added', { specialistId, hospitalId, doctorName: data.doctor_name });

    return specialist;
  }

  /**
   * Get all available specialties.
   */
  async getAllSpecialties(): Promise<Specialty[]> {
    return db('specialties').orderBy('display_order', 'asc');
  }
}

export default new HospitalService();
