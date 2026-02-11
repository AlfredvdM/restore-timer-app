import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get settings for a specific user
export const getSettings = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", args.userId))
      .unique();
  },
});

// Save (overwrite) settings for a user
export const saveSettings = mutation({
  args: {
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
    const existing = await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("timerSettings", args);
    }
  },
});

// Update a single setting field (for immediate save-on-change)
export const updateSetting = mutation({
  args: {
    userId: v.string(),
    field: v.string(),
    value: v.union(v.boolean(), v.number(), v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", args.userId))
      .unique();

    if (!existing) throw new Error("Settings not found");

    await ctx.db.patch(existing._id, { [args.field]: args.value });
  },
});

// Update window position only
export const updateWindowPosition = mutation({
  args: {
    userId: v.string(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", args.userId))
      .unique();

    if (!existing) return;

    await ctx.db.patch(existing._id, {
      windowPosition: { x: args.x, y: args.y },
    });
  },
});

// Get existing settings or create defaults if none exist
export const getOrCreateDefaultSettings = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("timerSettings")
      .withIndex("by_user", (idx) => idx.eq("userId", args.userId))
      .unique();

    if (existing) return existing;

    const defaults = {
      userId: args.userId,
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
