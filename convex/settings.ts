import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

const ALLOWED_SETTING_FIELDS = [
  "soundEnabled",
  "soundVolume",
  "chimeType",
  "yellowThreshold",
  "redThreshold",
  "alwaysOnTop",
  "defaultAppointmentType",
];

// Get settings for a specific user
export const getSettings = query({
  args: { token: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const { token, userId } = args;
    requireAuth(token);

    return await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", userId))
      .unique();
  },
});

// Save (overwrite) settings for a user
export const saveSettings = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
    soundEnabled: v.boolean(),
    soundVolume: v.number(),
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
  },
  handler: async (ctx, args) => {
    const { token, ...data } = args;
    requireAuth(token);

    const existing = await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", data.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("timerSettings", data);
    }
  },
});

// Update a single setting field (for immediate save-on-change)
export const updateSetting = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
    field: v.string(),
    value: v.union(v.boolean(), v.number(), v.string()),
  },
  handler: async (ctx, args) => {
    const { token, userId, field, value } = args;
    requireAuth(token);

    if (!ALLOWED_SETTING_FIELDS.includes(field)) {
      throw new Error(`Invalid setting field: ${field}`);
    }

    const existing = await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", userId))
      .unique();

    if (!existing) throw new Error("Settings not found");

    await ctx.db.patch(existing._id, { [field]: value });
  },
});

// Update window position only
export const updateWindowPosition = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const { token, userId, x, y } = args;
    requireAuth(token);

    const existing = await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", userId))
      .unique();

    if (!existing) return;

    await ctx.db.patch(existing._id, {
      windowPosition: { x, y },
    });
  },
});

// Get existing settings or create defaults if none exist
export const getOrCreateDefaultSettings = mutation({
  args: { token: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const { token, userId } = args;
    requireAuth(token);

    const existing = await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", userId))
      .unique();

    if (existing) return existing;

    const defaults = {
      userId,
      soundEnabled: true,
      soundVolume: 0.5,
      yellowThreshold: 0.6,
      redThreshold: 0.9,
      alwaysOnTop: true,
      defaultAppointmentType: "standard",
    };

    const id = await ctx.db.insert("timerSettings", defaults);
    return await ctx.db.get(id);
  },
});
