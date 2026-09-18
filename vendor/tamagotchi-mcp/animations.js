export const ANIMATIONS = {
    egg: [
        "    ◯◯◯\n   ◯   ◯\n  ◯     ◯\n   ◯   ◯\n    ◯◯◯",
        "    ●●●\n   ●   ●\n  ●  ~  ●\n   ●   ●\n    ●●●"
    ],
    baby: [
        "   ◕   ◕\n     ω\n  \\     /\n   ~~-~~",
        "   ◉   ◉\n     ◡\n  \\  ^  /\n   ~~-~~"
    ],
    child: [
        "  ◕     ◕\n     ◡\n \\       /\n  \\  ω  /\n   ~~~~~",
        "  ◉     ◉\n     ◠\n \\   ^   /\n  \\     /\n   ~~~~~"
    ],
    teen: [
        " ◕       ◕\n      ◡\n\\         /\n \\   ω   /\n  \\     /\n   ~~~~~",
        " ◉       ◉\n      ◠\n\\    ^    /\n \\       /\n  \\  ~  /\n   ~~~~~"
    ],
    adult: [
        "◕         ◕\n     ◡\n\\           /\n \\    ω    /\n  \\       /\n   \\     /\n    ~~~~~",
        "◉         ◉\n     ◠\n\\     ^     /\n \\         /\n  \\   ~   /\n   \\     /\n    ~~~~~"
    ],
    elder: [
        " ◔       ◔\n     ◡\n \\         /\n  \\   ω   /\n   \\  ~  /\n    ~~~~~\n     ^^^"
    ],
    sleeping: [
        " ◡       ◡\n      ~\n \\         /\n  \\  zzz  /\n   \\     /\n    ~~~~~"
    ],
    sick: [
        " ×       ×\n      ~\n \\         /\n  \\   ×   /\n   \\  ~  /\n    ~~~~~"
    ],
    happy: [
        " ◕       ◕\n      ◠\n \\    ^    /\n  \\  ♪♪  /\n   \\     /\n    ~~~~~"
    ],
    sad: [
        " ◕       ◕\n      ◡\n \\         /\n  \\  ~~  /\n   \\ ＿ /\n    ~~~~~"
    ],
    eating: [
        " ◕       ◕\n      ◡\n \\    ◯    /\n  \\  ω   /\n   \\     /\n    ~~~~~",
        " ◕       ◕\n      ◠\n \\         /\n  \\  ◯ω /\n   \\     /\n    ~~~~~"
    ],
    playing: [
        " ◉       ◉\n      ◠\n \\    ♪    /\n  \\  ◯   /\n   \\  ~  /\n    ~~~~~",
        " ◕       ◕\n      ◡\n \\    ♫    /\n  \\   ◯  /\n   \\  ^  /\n    ~~~~~"
    ]
};
export function getAnimation(stage, mood) {
    if (mood && ANIMATIONS[mood]) {
        const moodAnimations = ANIMATIONS[mood];
        return Array.isArray(moodAnimations) ?
            moodAnimations[Math.floor(Math.random() * moodAnimations.length)] :
            moodAnimations;
    }
    const stageAnimations = ANIMATIONS[stage];
    if (!stageAnimations)
        return ANIMATIONS.baby[0];
    return Array.isArray(stageAnimations) ?
        stageAnimations[Math.floor(Math.random() * stageAnimations.length)] :
        stageAnimations;
}
