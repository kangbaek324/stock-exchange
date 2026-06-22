export function getUtcMidnight(daysOffset: number = 0): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    if (daysOffset !== 0) {
        d.setUTCDate(d.getUTCDate() + daysOffset);
    }
    return d;
}
