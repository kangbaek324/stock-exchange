export function getKstDateToday() {
    const kstDateStr = new Date().toLocaleDateString('sv-SE', {
        timeZone: 'Asia/Seoul',
    });

    return new Date(kstDateStr + 'T00:00:00+09:00');
}
