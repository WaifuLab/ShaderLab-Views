export function hash(a, b) {
    return (a << 5) + a + b;
}

export function hashString(h, s) {
    for (let i = 0; i < s.length; i++)
        h = hash(h, s.charCodeAt(i));
    return h;
}
