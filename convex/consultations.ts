import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Save a completed consultation
export const saveConsultation = mutation({
  args: {
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
    const wentOvertime = args.actualDurationSeconds > args.targetDurationSeconds;
    const overtimeSeconds = wentOvertime
      ? args.actualDurationSeconds - args.targetDurationSeconds
      : 0;

    return await ctx.db.insert("consultations", {
      ...args,
      wentOvertime,
      overtimeSeconds,
      consultationDate: new Date(args.startedAt).toISOString().split("T")[0],
      status: "completed",
    });
  },
});

// Get consultation history with filters
export const getConsultations = query({
  args: {
    doctorId: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    appointmentType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q;

    if (args.doctorId) {
      q = ctx.db
        .query("consultations")
        .withIndex("by_doctor", (idx) => idx.eq("doctorId", args.doctorId!));
    } else {
      q = ctx.db.query("consultations").withIndex("by_date");
    }

    let results = await q.collect();

    // Apply filters
    if (args.startDate) {
      results = results.filter((c) => c.consultationDate >= args.startDate!);
    }
    if (args.endDate) {
      results = results.filter((c) => c.consultationDate <= args.endDate!);
    }
    if (args.appointmentType) {
      results = results.filter(
        (c) => c.appointmentType === args.appointmentType
      );
    }

    // Sort by completedAt descending (most recent first)
    results.sort((a, b) => b.completedAt - a.completedAt);

    // Apply limit
    if (args.limit) {
      results = results.slice(0, args.limit);
    }

    return results;
  },
});

// Get today's summary stats for a given doctor
export const getTodayStats = query({
  args: { doctorId: v.string() },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];

    const consultations = await ctx.db
      .query("consultations")
      .withIndex("by_doctor", (idx) =>
        idx.eq("doctorId", args.doctorId).eq("consultationDate", today)
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
