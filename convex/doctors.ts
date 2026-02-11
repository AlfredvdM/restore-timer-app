import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.trim();
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
  handler: async (ctx) => {
    const doctors = await ctx.db
      .query("doctors")
      .withIndex("by_active", (idx) => idx.eq("isActive", true))
      .collect();
    return doctors.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Get a single doctor by slug
export const getDoctorBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("doctors")
      .withIndex("by_slug", (idx) => idx.eq("slug", args.slug))
      .unique();
  },
});

// Update a doctor's name
export const updateDoctor = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_slug", (idx) => idx.eq("slug", args.slug))
      .unique();
    if (!doctor) throw new Error("Doctor not found");

    await ctx.db.patch(doctor._id, { name: args.name.trim() });
  },
});

// Soft-delete a doctor
export const deactivateDoctor = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_slug", (idx) => idx.eq("slug", args.slug))
      .unique();
    if (!doctor) throw new Error("Doctor not found");

    await ctx.db.patch(doctor._id, { isActive: false });
  },
});

// Idempotent migration: create doctor record for existing "dr-annetjie" data
export const migrateExistingDoctor = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("doctors")
      .withIndex("by_slug", (idx) => idx.eq("slug", "dr-annetjie"))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("doctors", {
      slug: "dr-annetjie",
      name: "Dr Annetjie van der Nest",
      colour: "#059669",
      isActive: true,
      createdAt: Date.now(),
    });
  },
});
