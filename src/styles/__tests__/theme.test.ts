import { colors, spacing, radii, typography, shadows } from "../theme";

describe("theme tokens", () => {
  it("exposes the core color palette", () => {
    expect(colors.bg).toBe("#0A0A0E");
    expect(colors.surface).toBe("#131318");
    expect(colors.surfaceHigh).toBe("#1C1C24");
    expect(colors.accent).toBe("#E5484D");
    expect(colors.gold).toBe("#F5C518");
    expect(colors.text).toBe("#FFFFFF");
    expect(colors.textSecondary).toBe("#B8B8C0");
    expect(colors.textMuted).toBe("#71717A");
  });

  it("exposes spacing, radii, typography, shadows", () => {
    expect(spacing.md).toBe(12);
    expect(radii.card).toBe(14);
    expect(typography.heading.fontSize).toBe(18);
    expect(typography.body.lineHeight).toBe(20);
    expect(shadows.card.elevation).toBe(8);
  });
});
