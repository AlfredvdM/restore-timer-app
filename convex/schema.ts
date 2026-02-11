import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Consultation log — the core data this app produces
  consultations: defineTable({
    doctorId: v.string(),
    doctorName: v.string(),
    patientName: v.optional(v.string()),
    appointmentType: v.string(),
    targetDurationSeconds: v.number(),
    actualDurationSeconds: v.number(),
    wentOvertime: v.boolean(),
    overtimeSeconds: v.optional(v.number()),
    pausedDurationSeconds: v.number(),
    consultationDate: v.string(),
    startedAt: v.number(),
    completedAt: v.number(),
    notes: v.optional(v.string()),
    status: v.union(v.literal("completed"), v.literal("cancelled")),
  })
    .index("by_doctor", ["doctorId", "consultationDate"])
    .index("by_date", ["consultationDate"])
    .index("by_doctor_and_type", ["doctorId", "appointmentType"]),

  // Appointment type definitions — configurable by the practice
  appointmentTypes: defineTable({
    name: v.string(),
    code: v.string(),
    defaultDurationMinutes: v.number(),
    colour: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"]),

  // User settings for the timer app
  timerSettings: defineTable({
    userId: v.string(),
    soundEnabled: v.boolean(),
    soundVolume: v.number(),
    chimeType: v.optional(v.string()),
    yellowThreshold: v.number(),
    redThreshold: v.number(),
    alwaysOnTop: v.boolean(),
    defaultAppointmentType: v.optional(v.string()),
    windowPosition: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
      })
    ),
  }).index("by_user", ["userId"]),
});
