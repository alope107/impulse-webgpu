import { global_invocation_index } from "./linear_indexing.js";
import { rectStruct, circleStruct, uniformsStruct, physStruct } from "./structs.js";

export const computeShaderCode = /* wgsl */ `
${global_invocation_index}

${physStruct.code}
${rectStruct.code}
${circleStruct.code}
${uniformsStruct.code}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read_write> rects : array<Rect>; 
@group(0) @binding(2) var<storage, read_write> circles : array<Circle>; 


// TODO: better workgroup size UPDATE THE GLOBAL INDEX CALC IF CHANGED
@compute @workgroup_size(8, 8, 1) fn moveRects(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(num_workgroups) num_workgroups: vec3<u32>) {
        let id = global_invocation_index(workgroup_id, local_invocation_index, num_workgroups,
                                         8*8*1 /* CHANGE ME WHEN WORKGROUP SIZE CHANGES */);
        if(id >= arrayLength(&rects)) { return; }

        // Just making sure we don't lose our bindings
        // TODO: Automatic binding creation
        _ = circles[0].radius;
        _ = rects[0].topLeft;
        _ = uniforms.pointerHeld;

        let rect = &rects[id];
        rect.topLeft += rect.phys.velocity;
        rect.bottomRight += rect.phys.velocity;

        // TODO: broad phase collision etc. etc.
        rect.overlaps = 0;
        for(var i = 0u; i < arrayLength(&rects); i++) {
            let other = &rects[i];
            rect.overlaps |= select(0u, 1u, rectOverlaps(rect, other) && id != i);
        }

        for(var i = 0u; i < arrayLength(&circles); i++) {
            let circle = &circles[i];
            rect.overlaps |= select(0u, 1u, rectCircleOverlaps(rect, circle));
        }
}

fn rectOverlaps(r1 : ptr<storage, Rect, read_write>, r2: ptr<storage, Rect, read_write>) -> bool {
    return !(r1.bottomRight.x < r2.topLeft.x) &&
           !(r2.bottomRight.x < r1.topLeft.x) &&
           !(r1.bottomRight.y < r2.topLeft.y) &&
           !(r2.bottomRight.y < r1.topLeft.y);
}

// TODO: better workgroup size UPDATE THE GLOBAL INDEX CALC IF CHANGED
@compute @workgroup_size(8, 8, 1) fn moveCircles(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(num_workgroups) num_workgroups: vec3<u32>) {
        let id = global_invocation_index(workgroup_id, local_invocation_index, num_workgroups,
                                         8*8*1 /* CHANGE ME WHEN WORKGROUP SIZE CHANGES */);
        if(id >= arrayLength(&circles)) { return; }

        // Just making sure we don't lose our bindings
        _ = circles[0].radius;
        _ = rects[0].topLeft;
        _ = uniforms.pointerHeld;

        let circle = &circles[id];
        circle.center += circle.phys.velocity;

        // TODO: broad phase collision etc. etc.
        circle.overlaps = 0;
        for(var i = 0u; i < arrayLength(&circles); i++) {
            let other = &circles[i];
            circle.overlaps |= select(0u, 1u, circleOverlaps(circle, other) && id != i);
        }

        for(var i = 0u; i < arrayLength(&rects); i++) {
            let rect = &rects[i];
            circle.overlaps |= select(0u, 1u, rectCircleOverlaps(rect, circle));
        }
}

fn circleOverlaps(c1 : ptr<storage, Circle, read_write>, c2: ptr<storage, Circle, read_write>) -> bool {
    let delta = c1.center - c2.center;
    let squaredDist = dot(delta, delta);
    return squaredDist < pow((c1.radius + c2.radius), 2);
}

// Adapted from https://stackoverflow.com/questions/401847/circle-rectangle-collision-detection-intersection
fn rectCircleOverlaps(r : ptr<storage, Rect, read_write>, c: ptr<storage, Circle, read_write>) -> bool {
    // TODO: cache rect center amnd dims?
    let rHalfDims = abs(vec2f(
        (r.bottomRight.x - r.topLeft.x) /2,
        (r.topLeft.y - r.bottomRight.y) /2
    ));
    let rCenter = vec2f(
        r.topLeft.x + rHalfDims.x,
        r.bottomRight.y - rHalfDims.y
    );

    let delta = abs(c.center - rCenter);

    if(delta.x > rHalfDims.x + c.radius ||
       delta.y >  rHalfDims.y + c.radius) {
        return false;
    }

    if(delta.x < rHalfDims.x ||
       delta.y <  rHalfDims.y) {
        return true;
    }

    let corner = delta - rHalfDims;
    let squaredCorner = dot(corner, corner);

    return squaredCorner < pow(c.radius, 2);
}
`;