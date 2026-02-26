import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// Save a completed consultation
export const saveConsultation = mutation({
  args: {
    token: v.string(),
    doctorId: v.string(),
    doctorName: v.string(),
    patientName: v.optional(v.string()),
    appointmentType: v.string(),
    targetDurationSeconds: v.number(),
    actualDurationSeconds: v.number(),
    pausedDurationSeconds: v.number(),
    notes: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { token, ...data } = args;
    requireAuth(token);

    const wentOvertime = data.actualDurationSeconds > data.targetDurationSeconds;
    const overtimeSeconds = wentOvertime
      ? data.actualDurationSeconds - data.targetDurationSeconds
      : 0;

    return await ctx.db.insert("consultations", {
      ...data,
      wentOvertime,
      overtimeSeconds,
      consultationDate: new Date(data.startedAt).toISOString().split("T")[0],
      status: "completed",
    });
  },
});

// Get consultation history with filters
export const getConsultations = query({
  args: {
    token: v.string(),
    doctorId: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    appointmentType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { token, ...filters } = args;
    requireAuth(token);

    let q;

    if (filters.doctorId) {
      q = ctx.db
        .query("consultations")
        .withIndex("by_doctor", (idx) => idx.eq("doctorId", filters.doctorId!));
    } else {
      q = ctx.db.query("consultations").withIndex("by_date");
    }

    let results = await q.collect();

    // Apply filters
    if (filters.startDate) {
      results = results.filter((c) => c.consultationDate >= filters.startDate!);
    }
    if (filters.endDate) {
      results = results.filter((c) => c.consultationDate <= filters.endDate!);
    }
    if (filters.appointmentType) {
      results = results.filter(
        (c) => c.appointmentType === filters.appointmentType
      );
    }

    // Sort by completedAt descending (most recent first)
    results.sort((a, b) => b.completedAt - a.completedAt);

    // Apply limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  },
});

// Get all consultations across all doctors (for "All Doctors" history view)
export const getAllConsultations = query({
  args: {
    token: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    appointmentType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { token, ...filters } = args;
    requireAuth(token);

    let results = await ctx.db
      .query("consultations")
      .withIndex("by_date")
      .collect();

    if (filters.startDate) {
      results = results.filter((c) => c.consultationDate >= filters.startDate!);
    }
    if (filters.endDate) {
      results = results.filter((c) => c.consultationDate <= filters.endDate!);
    }
    if (filters.appointmentType) {
      results = results.filter(
        (c) => c.appointmentType === filters.appointmentType
      );
    }

    results.sort((a, b) => b.completedAt - a.completedAt);

    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  },
});

// Get all unique consultation dates (for calendar dot indicators)
export const getConsultationDates = query({
  args: {
    token: v.string(),
    doctorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { token, ...filters } = args;
    requireAuth(token);

    let results;

    if (filters.doctorId) {
      results = await ctx.db
        .query("consultations")
        .withIndex("by_doctor", (idx) => idx.eq("doctorId", filters.doctorId!))
        .collect();
    } else {
      results = await ctx.db
        .query("consultations")
        .withIndex("by_date")
        .collect();
    }

    const dateSet = new Set(results.map((c) => c.consultationDate));
    return Array.from(dateSet).sort();
  },
});

// Clear all consultations (with optional doctor filter)
export const clearAllConsultations = mutation({
  args: {
    token: v.string(),
    doctorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { token, ...filters } = args;
    requireAuth(token);

    let results;

    if (filters.doctorId) {
      results = await ctx.db
        .query("consultations")
        .withIndex("by_doctor", (idx) => idx.eq("doctorId", filters.doctorId!))
        .collect();
    } else {
      results = await ctx.db.query("consultations").collect();
    }

    for (const doc of results) {
      await ctx.db.delete(doc._id);
    }

    return { deletedCount: results.length };
  },
});

// Get today's summary stats for a given doctor
export const getTodayStats = query({
  args: {
    token: v.string(),
    doctorId: v.string(),
  },
  handler: async (ctx, args) => {
    const { token, doctorId } = args;
    requireAuth(token);

    const today = new Date().toISOString().split("T")[0];

    const consultations = await ctx.db
      .query("consultations")
      .withIndex("by_doctor", (idx) =>
        idx.eq("doctorId", doctorId).eq("consultationDate", today)
      )
      .collect();

    const completed = consultations.filter((c) => c.status === "completed");
    const totalConsultations = completed.length;

    if (totalConsultations === 0) {
      return {
        totalConsultations: 0,
        averageDurationSeconds: 0,
        percentOnTime: 0,
        mostUsedAppointmentType: null,
      };
    }

    const totalDuration = completed.reduce(
      (sum, c) => sum + c.actualDurationSeconds,
      0
    );
    const averageDurationSeconds = Math.round(totalDuration / totalConsultations);
    const onTimeCount = completed.filter((c) => !c.wentOvertime).length;
    const percentOnTime = Math.round((onTimeCount / totalConsultations) * 100);

    // Find most used appointment type
    const typeCounts: Record<string, number> = {};
    for (const c of completed) {
      typeCounts[c.appointmentType] = (typeCounts[c.appointmentType] || 0) + 1;
    }
    const mostUsedAppointmentType = Object.entries(typeCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? null;

    return {
      totalConsultations,
      averageDurationSeconds,
      percentOnTime,
      mostUsedAppointmentType,
    };
  },
});
