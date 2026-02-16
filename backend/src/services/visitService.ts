import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import {
  UserVisit,
  VisitFeedback,
  VisitType,
  VisitStatus,
  PaginationInfo,
} from '../../../shared/types';
import { FEEDBACK_DELAY_HOURS } from '../../../shared/constants';
import logger from '../utils/logger';

interface CreateVisitInput {
  hospital_id: string;
  specialist_id?: string;
  visit_date: string;
  visit_type: VisitType;
  chief_complaint?: string;
}

interface FeedbackInput {
  rating: number;
  wait_time_rating: number;
  staff_rating: number;
  facility_rating: number;
  comments?: string;
  would_recommend: boolean;
}

/**
 * Visit service - manages hospital visits, feedback collection,
 * and visit history for users.
 */
class VisitService {
  /**
   * Create a new visit record.
   */
  async createVisit(userId: string, input: CreateVisitInput): Promise<UserVisit> {
    const visitId = uuidv4();
    const now = new Date().toISOString();

    // Verify hospital exists
    const hospital = await db('hospitals')
      .where('hospital_id', input.hospital_id)
      .first();

    if (!hospital) {
      throw new Error('Hospital not found.');
    }

    // Verify specialist if provided
    if (input.specialist_id) {
      const specialist = await db('hospital_specialists')
        .where('specialist_id', input.specialist_id)
        .where('hospital_id', input.hospital_id)
        .first();

      if (!specialist) {
        throw new Error('Specialist not found at this hospital.');
      }
    }

    const [visit] = await db('user_visits')
      .insert({
        visit_id: visitId,
        user_id: userId,
        hospital_id: input.hospital_id,
        specialist_id: input.specialist_id || null,
        visit_date: input.visit_date,
        visit_type: input.visit_type,
        chief_complaint: input.chief_complaint || null,
        status: input.visit_type === 'emergency' ? 'scheduled' : 'scheduled',
        created_at: now,
        updated_at: now,
      })
      .returning('*');

    logger.info('Visit created', {
      visitId,
      userId,
      hospitalId: input.hospital_id,
      visitType: input.visit_type,
    });

    return visit;
  }

  /**
   * Get a user's visit history with optional filtering and pagination.
   */
  async getUserVisitHistory(
    userId: string,
    options: {
      status?: VisitStatus;
      visitType?: VisitType;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ visits: UserVisit[]; pagination: PaginationInfo }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    let query = db('user_visits as v')
      .select(
        'v.*',
        'h.hospital_name',
        'h.address as hospital_address',
        'h.city as hospital_city',
        'h.state as hospital_state',
        'hs.doctor_name',
        's.specialty_name'
      )
      .leftJoin('hospitals as h', 'v.hospital_id', 'h.hospital_id')
      .leftJoin('hospital_specialists as hs', 'v.specialist_id', 'hs.specialist_id')
      .leftJoin('specialties as s', 'hs.specialty_id', 's.specialty_id')
      .where('v.user_id', userId);

    if (options.status) {
      query = query.where('v.status', options.status);
    }

    if (options.visitType) {
      query = query.where('v.visit_type', options.visitType);
    }

    // Count total
    const countQuery = db('user_visits').where('user_id', userId);
    if (options.status) countQuery.where('status', options.status);
    if (options.visitType) countQuery.where('visit_type', options.visitType);
    const [{ count }] = await countQuery.count('* as count');
    const total = parseInt(count as string, 10);

    const visits = await query
      .orderBy('v.visit_date', 'desc')
      .limit(limit)
      .offset(offset);

    // Attach feedback if it exists
    const visitIds = visits.map((v: UserVisit) => v.visit_id);
    if (visitIds.length > 0) {
      const feedbacks = await db('visit_feedback')
        .whereIn('visit_id', visitIds);

      const feedbackMap = new Map<string, VisitFeedback>(
        feedbacks.map((f: VisitFeedback) => [f.visit_id, f])
      );

      for (const visit of visits) {
        visit.feedback = feedbackMap.get(visit.visit_id) || undefined;
      }
    }

    return {
      visits,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get detailed information about a specific visit.
   */
  async getVisitDetails(visitId: string, userId: string): Promise<UserVisit | null> {
    const visit = await db('user_visits as v')
      .select(
        'v.*',
        'h.hospital_name',
        'h.address as hospital_address',
        'h.city as hospital_city',
        'h.state as hospital_state',
        'h.phone_number as hospital_phone',
        'hs.doctor_name',
        'hs.consultation_fee',
        's.specialty_name',
        's.specialty_code'
      )
      .leftJoin('hospitals as h', 'v.hospital_id', 'h.hospital_id')
      .leftJoin('hospital_specialists as hs', 'v.specialist_id', 'hs.specialist_id')
      .leftJoin('specialties as s', 'hs.specialty_id', 's.specialty_id')
      .where('v.visit_id', visitId)
      .where('v.user_id', userId)
      .first();

    if (!visit) {
      return null;
    }

    // Attach feedback
    const feedback = await db('visit_feedback')
      .where('visit_id', visitId)
      .first();

    visit.feedback = feedback || undefined;

    return visit;
  }

  /**
   * Update visit details (status, diagnosis, notes, etc.).
   */
  async updateVisitStatus(
    visitId: string,
    userId: string,
    updates: {
      status?: VisitStatus;
      diagnosis?: string;
      prescription?: string;
      notes?: string;
    }
  ): Promise<UserVisit | null> {
    const existing = await db('user_visits')
      .where('visit_id', visitId)
      .where('user_id', userId)
      .first();

    if (!existing) {
      return null;
    }

    const [updated] = await db('user_visits')
      .where('visit_id', visitId)
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .returning('*');

    logger.info('Visit updated', {
      visitId,
      userId,
      changes: Object.keys(updates),
    });

    return updated;
  }

  /**
   * Submit feedback for a completed visit.
   */
  async submitFeedback(
    visitId: string,
    userId: string,
    input: FeedbackInput
  ): Promise<VisitFeedback> {
    // Verify visit exists and belongs to user
    const visit = await db('user_visits')
      .where('visit_id', visitId)
      .where('user_id', userId)
      .first();

    if (!visit) {
      throw new Error('Visit not found.');
    }

    if (visit.status !== 'completed') {
      throw new Error('Feedback can only be submitted for completed visits.');
    }

    // Check for existing feedback
    const existingFeedback = await db('visit_feedback')
      .where('visit_id', visitId)
      .first();

    if (existingFeedback) {
      throw new Error('Feedback has already been submitted for this visit.');
    }

    const feedbackId = uuidv4();

    const [feedback] = await db('visit_feedback')
      .insert({
        feedback_id: feedbackId,
        visit_id: visitId,
        user_id: userId,
        rating: input.rating,
        wait_time_rating: input.wait_time_rating,
        staff_rating: input.staff_rating,
        facility_rating: input.facility_rating,
        comments: input.comments || null,
        would_recommend: input.would_recommend,
        submitted_at: new Date().toISOString(),
      })
      .returning('*');

    logger.info('Visit feedback submitted', {
      feedbackId,
      visitId,
      userId,
      rating: input.rating,
    });

    // Update hospital rating aggregate
    await this.updateHospitalRating(visit.hospital_id);

    return feedback;
  }

  /**
   * Get visits that are completed 2+ hours ago but have no feedback yet.
   */
  async getPendingFeedback(userId: string): Promise<UserVisit[]> {
    const feedbackThreshold = new Date(
      Date.now() - FEEDBACK_DELAY_HOURS * 60 * 60 * 1000
    ).toISOString();

    return db('user_visits as v')
      .select(
        'v.*',
        'h.hospital_name',
        'h.address as hospital_address',
        'hs.doctor_name',
        's.specialty_name'
      )
      .leftJoin('hospitals as h', 'v.hospital_id', 'h.hospital_id')
      .leftJoin('hospital_specialists as hs', 'v.specialist_id', 'hs.specialist_id')
      .leftJoin('specialties as s', 'hs.specialty_id', 's.specialty_id')
      .leftJoin('visit_feedback as vf', 'v.visit_id', 'vf.visit_id')
      .where('v.user_id', userId)
      .where('v.status', 'completed')
      .where('v.updated_at', '<=', feedbackThreshold)
      .whereNull('vf.feedback_id')
      .orderBy('v.visit_date', 'desc');
  }

  /**
   * Recalculate and update the aggregate rating for a hospital.
   */
  private async updateHospitalRating(hospitalId: string): Promise<void> {
    try {
      const [result] = await db('visit_feedback as vf')
        .join('user_visits as v', 'vf.visit_id', 'v.visit_id')
        .where('v.hospital_id', hospitalId)
        .avg('vf.rating as avg_rating');

      if (result?.avg_rating) {
        const roundedRating = Math.round(parseFloat(result.avg_rating) * 10) / 10;
        await db('hospitals')
          .where('hospital_id', hospitalId)
          .update({ rating: roundedRating, updated_at: new Date().toISOString() });
      }
    } catch (error) {
      logger.error('Failed to update hospital rating', { hospitalId, error });
    }
  }
}

export default new VisitService();
