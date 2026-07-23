import { randClip, randRange } from "./random.js";

// Want to recompute layouts?
// Go here! https://webgpufundamentals.org/webgpu/lessons/resources/wgsl-offset-computer.html

export const rectStruct = (() => { 
    const code = /* wgsl */`
        struct Rect {
            topLeft: vec2f, // 8 bytes
            bottomRight: vec2f // 8 bytes
        }  // total 16 bytes
    `
    const byteCount = 16;
    const floatCount = byteCount / 4;
    const createEmptyArray = (rectCount) => {
        const data = new ArrayBuffer(byteCount * rectCount);
        return {
            data,
            views: {
                topLeftView: new Float32Array(data, 0),
                bottomRightView: new Float32Array(data, 8),
            },
            count: rectCount
        };
    };
    const createFilledArray = (rectData) => {
        const data = createEmptyArray(rectData.length);
        const {topLeftView, bottomRightView} = data.views;
        rectData.forEach(({topLeft, bottomRight}, i) => {
            topLeftView.set(topLeft, i*floatCount);
            bottomRightView.set(bottomRight, i*floatCount);
        });
        return data;
    };
    const randomJSRects = (count, minWidth, maxWidth) => {
        const rects = [];
        for(let i = 0; i < count; i++) {
            const topLeft = [randClip(), randClip()];
            const w = randRange(minWidth, maxWidth), h = randRange(minWidth, maxWidth);
            rects.push({
                topLeft,
                bottomRight: [Math.min(topLeft[0] + w, 1), Math.min(topLeft[1] + h, 1)]
           });
         }
         console.log(rects);
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