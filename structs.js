import { randClip, randRange } from "./random.js";
import { randSolidColor } from "./color.js"

// Want to recompute layouts?
// Go here! https://webgpufundamentals.org/webgpu/lessons/resources/wgsl-offset-computer.html

export const rectStruct = (() => { 
    const code = /* wgsl */`
        struct Rect {
            topLeft: vec2f, // 8 bytes
            bottomRight: vec2f, // 8 bytes
            velocity: vec2f, // 8 bytes
            overlaps: u32 // 4 bytes
            // pad 4 bytes
        }  // total 32 bytes
    `
    const byteCount = 32;
    const floatCount = byteCount / 4;
    const uint32Count = byteCount / 4;
    const createEmptyArray = (rectCount) => {
        const data = new ArrayBuffer(byteCount * rectCount);
        return {
            data,
            views: {
                topLeftView: new Float32Array(data, 0),
                bottomRightView: new Float32Array(data, 8),
                velocityView: new Float32Array(data, 16),
                overlapsView: new Uint32Array(data, 24),
            },
            count: rectCount
        };
    };
    const createFilledArray = (rectData) => {
        const data = createEmptyArray(rectData.length);
        const {topLeftView, bottomRightView, velocityView} = data.views;
        rectData.forEach(({topLeft, bottomRight, velocity}, i) => {
            topLeftView.set(topLeft, i*floatCount);
            bottomRightView.set(bottomRight, i*floatCount);
            velocityView.set(velocity, i*floatCount);
            // overlaps and padding automatically set to 0
        });
        return data;
    };
    const randomJSRects = (count, minWidth, maxWidth, maxVelComp) => {
        const rects = [];
        for(let i = 0; i < count; i++) {
            const topLeft = [randClip(), randClip()];
            const w = randRange(minWidth, maxWidth), h = randRange(minWidth, maxWidth);
            const velocity = [randRange(-maxVelComp, maxVelComp), randRange(-maxVelComp, maxVelComp)]
            rects.push({
                topLeft,
                bottomRight: [Math.min(topLeft[0] + w, 1), Math.min(topLeft[1] + h, 1)],
                velocity
           });
         }
        return rects;
    };
    return {
        code,
        byteCount,
        floatCount,
        createEmptyArray,
        createFilledArray,
        randomJSRects
    };
})();

export const circleStruct = (() => { 
    const code = /* wgsl */`
        struct Circle {
            color: vec4f, // 16 bytes
            center: vec2f, // 8 bytes
            radius: f32, // 4 bytes
            overlaps: u32, // 4 bytes
            velocity: vec2f, // 8 bytes
            // pad 8 bytes
        }  // total 48 bytes
    `
    const byteCount = 48;
    const floatCount = byteCount / 4;
    const uint32Count = byteCount / 4;
    const createEmptyArray = (circleCount) => {
        const data = new ArrayBuffer(byteCount * circleCount);
        return {
            data,
            views: {
                colorView: new Float32Array(data, 0),
                centerView: new Float32Array(data, 16),
                radiusView: new Float32Array(data, 24),
                overlapsView: new Uint32Array(data, 28),
                velocityView: new Float32Array(data, 32),
            },
            count: circleCount
        };
    };
    const createFilledArray = (circleData) => {
        const data = createEmptyArray(circleData.length);
        const {colorView, centerView, radiusView, velocityView} = data.views;
        circleData.forEach(({color, center, radius, velocity}, i) => {
            colorView.set(color, i*floatCount);
            centerView.set(center, i*floatCount);
            radiusView.set([radius], i*floatCount);
            // overlaps set to 0s
            velocityView.set(velocity, i*floatCount);
            // pad set to 0s
        });
        return data;
    };
    const randJSCircles =  (circleCount, minRadius, maxRadius, maxVelComp) => {
        let circles = [];
        for(let i = 0; i < circleCount; i++) {
            const velocity = [randRange(-maxVelComp, maxVelComp), randRange(-maxVelComp, maxVelComp)]
            circles.push({
                center: [randClip(), randClip()],
                color: randSolidColor(),
                radius: randRange(minRadius, maxRadius),
                velocity
            });
        }
        return circles;
    }
    return {
        code,
        byteCount,
        floatCount,
        createEmptyArray,
        createFilledArray,
        randJSCircles
    };
})();


export const uniformsStruct = (() => { 
    const code = /* wgsl */ `
        struct Uniforms {
            pointerLoc: vec2f, // 8 bytes, location of pointer
            pointerPressed: u32, // 4 bytes, was the pointer first pressed this frame?
            pointerHeld: u32 // 4 bytes, is the pointer currently held down?
        } // total 16 bytes
`;
    const byteCount = 16;
    const u32Count = byteCount/4;
    const floatCount = byteCount/4;
    const createEmpty = () => {
        const data = new ArrayBuffer(byteCount);
        return {
            data,
            views: {
                pointerLocView: new Float32Array(data, 0),
                pointerPressedView: new Uint32Array(data, 8),
                pointerHeldView: new Uint32Array(data, 12),
            },
            count: 1
        };
    };
    return {
        code,
        byteCount,
        u32Count,
        floatCount,
        createEmpty,
        createFilled: ({pointerLoc, pointerPressed, pointerHeld}) => {
            const uniform = createEmpty();
            uniform.views.pointerLocView.set(pointerLoc, 0);
            uniform.views.pointerPressedView.set([pointerPressed], 0);
            uniform.views.pointerHeldView.set([pointerHeld], 0);
            return uniform;
        }
    };
})();