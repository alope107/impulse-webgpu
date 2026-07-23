export const randRange =  (min, max) => Math.random() * (max-min) + min; // random in range
export const randClip = () => randRange(-1, 1); // random inside clip bound
export const randColor = () => [Math.random(), Math.random(), Math.random(), 1.];
