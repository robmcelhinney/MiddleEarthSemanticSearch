// src/utils.js

export function dotProduct(a, b) {
    if (a.length !== b.length) {
        throw new Error("Vectors must be of the same length")
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
        result += a[i] * b[i]
    }
    return result
}
