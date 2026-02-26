import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// Preset colour palette for doctor profiles
const DOCTOR_COLOURS = [
  "#059669", // emerald-600
  "#2563eb", // blue-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
  "#d97706", // amber-600
  "#0891b2", // cyan-600
  "#dc2626", // red-600
  "#4f46e5", // indigo-600
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Create a new doctor profile
export const createDoctor = mutation({
  args: { token: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const { token, name: rawName } = args;
    requireAuth(token);

    const name = rawName.trim();
    if (!name) throw new Error("Name is required");

    const slug = slugify(name);

    // Check for duplicate slug
    const existing = await ctx.db
      .query("doctors")
      .withIndex("by_slug", (idx) => idx.eq("slug", slug))
      .unique();
    if (existing) throw new Error("A doctor with this name already exists");

    // Assign colour based on current doctor count
    const allDoctors = await ctx.db.query("doctors").collect();
    const colourIndex = allDoctors.length % DOCTOR_COLOURS.length;

    const doctorId = await ctx.db.insert("doctors", {
      slug,
      name,
      colour: DOCTOR_COLOURS[colourIndex],
      isActive: true,
      createdAt: Date.now(),
    });

    // Create default timer settings for the new doctor
    const existingSettings = await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", slug))
      .unique();

    if (!existingSettings) {
      await ctx.db.insert("timerSettings", {
        userId: slug,
        soundEnabled: true,
        soundVolume: 0.5,
        yellowThreshold: 0.6,
        redThreshold: 0.9,
        alwaysOnTop: true,
        defaultAppointmentType: "standard",
      });
    }

    return doctorId;
  },
});

// Get all active doctors sorted by name
export const getAllDoctors = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAuth(args.token);

    const doctors = await ctx.db
      .query("doctors")
      .withIndex("by_active", (idx) => idx.eq("isActive", true))
      .collect();
    return doctors.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Get a single doctor by slug
export const getDoctorBySlug = query({
  args: { token: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const { token, slug } = args;
    requireAuth(token);

    return await ctx.db
      .query("doctors")
      .withIndex("by_slug", (idx) => idx.eq("slug", slug))
      .unique();
  },
});

// Update a doctor's name
export const updateDoctor = mutation({
  args: { token: v.string(), slug: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const { token, slug, name } = args;
    requireAuth(token);

    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_slug", (idx) => idx.eq("slug", slug))
      .unique();
    if (!doctor) throw new Error("Doctor not found");

    await ctx.db.patch(doctor._id, { name: name.trim() });
  },
});

// Delete a doctor profile (consultation history is preserved)
export const deleteDoctor = mutation({
  args: { token: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const { token, slug } = args;
    requireAuth(token);

    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_slug", (idx) => idx.eq("slug", slug))
      .unique();
    if (!doctor) throw new Error("Doctor not found");

    // Delete the doctor record
    await ctx.db.delete(doctor._id);

    // Also delete their timer settings
    const settings = await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", slug))
      .unique();
    if (settings) {
      await ctx.db.delete(settings._id);
    }
  },
});

// Idempotent migration: create doctor record for existing "dr-annetjie" data
export const migrateExistingDoctor = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAuth(args.token);

    const existing = await ctx.db
      .query("doctors")
      .withIndex("by_slug", (idx) => idx.eq("slug", "dr-annetjie"))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("doctors", {
      slug: "dr-annetjie",
      name: "Practice Doctor",
      colour: "#059669",
      isActive: true,
      createdAt: Date.now(),
    });
  },
});
