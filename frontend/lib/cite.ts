const SCHEDULE_NUM: Record<string, number> = { First: 1, Second: 2, Third: 3, Fourth: 4 };

/** Where a citation like "Act s.21(1)(b)" points in the Reader, or null if unknown. */
export function citationHref(cite: string): string | null {
  let m = cite.match(/^(Act|Reg) (?:s|r)\.(\d+[A-Z]?)/);
  if (m) return `/read/${m[1] === "Act" ? "act" : "reg"}/${m[2]}`;
  m = cite.match(/^By-law (\d+)/);
  if (m) return `/read/reg/bl-${m[1]}`;
  m = cite.match(/^Form (\d+[A-Z]?)/);
  if (m) return `/read/reg/form-${m[1]}`;
  m = cite.match(/^(Act|Reg) (First|Second|Third|Fourth) Schedule/);
  if (m) {
    if (m[1] === "Act") return `/read/act/sch-${SCHEDULE_NUM[m[2]]}`;
    return { First: "/read/reg/sch-1", Second: "/read/reg/form-1", Third: "/read/reg/bl-1" }[m[2]] ?? null;
  }
  return null;
}
