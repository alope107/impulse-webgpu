import { global_invocation_index } from "./linear_indexing.js";
import { rectStruct, circleStruct, uniformsStruct, physStruct } from "./structs.js";

export const computeShaderCode = /* wgsl */ `
${global_invocation_index}

${physStruct.code}
${rectStruct.code}
${circleStruct.code}
${uniformsStruct.code}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read_write> oldRects : array<Rect>; 
@group(0) @binding(2) var<storage, read_write> oldCircles : array<Circle>;
@group(0) @binding(3) var<storage, read_write> newRects : array<Rect>; 
@group(0) @binding(4) var<storage, read_write> newCircles : array<Circle>; 


// TODO: better workgroup size UPDATE THE GLOBAL INDEX CALC IF CHANGED
@compute @workgroup_size(8, 8, 1) fn moveRects(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(num_workgroups) num_workgroups: vec3<u32>) {
        let id = global_invocation_index(workgroup_id, local_invocation_index, num_workgroups,
                                         8*8*1 /* CHANGE ME WHEN WORKGROUP SIZE CHANGES */);
        if(id >= arrayLength(&oldRects)) { return; }

        // Just making sure we don't lose our bindings
        // TODO: Automatic binding creation
        _ = oldCircles[0].radius;
        _ = newCircles[0].radius;
        _ = oldRects[0].topLeft;
        _ = newRects[0].topLeft;
        _ = uniforms.pointerHeld;

        let rect = &newRects[id];
        rect.topLeft += rect.phys.velocity;
        rect.bottomRight += rect.phys.velocity;

        // TODO: broad phase collision etc. etc.
        rect.overlaps = 0;
        for(var i = 0u; i < arrayLength(&oldRects); i++) {
            let other = &oldRects[i];
            rect.overlaps |= select(0u, 1u, rectOverlaps(rect, other) && id != i);
        }

        for(var i = 0u; i < arrayLength(&oldCircles); i++) {
            let circle = &oldCircles[i];
            rect.overlaps |= select(0u, 1u, rectCircleOverlaps(rect, circle));
        }
}


// Firefox complains about these pointers :'(
// Argument 'r1' at index 0 is a pointer of space Storage { access: StorageAccess(LOAD | STORE) }, which can't be passed into functions.
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
        if(id >= arrayLength(&oldCircles)) { return; }

        // Just making sure we don't lose our bindings
        _ = oldCircles[0].radius;
        _ = newCircles[0].radius;
        _ = oldRects[0].topLeft;
        _ = newRects[0].topLeft;
        _ = uniforms.pointerHeld;

        let circle = &newCircles[id];
        circle.center += circle.phys.velocity;

        // TODO: broad phase collision etc. etc.
        circle.overlaps = 0;
        for(var i = 0u; i < arrayLength(&oldCircles); i++) {
            let other = &oldCircles[i];
            let normal = circleCollisionNormal(circle, other);
            let collides = !all(normal == vec2f()) && id != i;
            circle.overlaps |= select(0u, 1u, collides);
            if(collides) { // TODO: branchless?

            }
        }

        for(var i = 0u; i < arrayLength(&oldRects); i++) {
            let rect = &oldRects[i];
            circle.overlaps |= select(0u, 1u, rectCircleOverlaps(rect, circle));
        }
}

fn circleCollisionNormal(c1 : ptr<storage, Circle, read_write>, c2: ptr<storage, Circle, read_write>) -> vec2f {
    let delta = c2.center - c1.center;
    let squaredDist = dot(delta, delta);
    return select(
        vec2f(), // zero vector if not colliding
        delta / sqrt(squaredDist), // unit normal vector of c1 to c2 if colliding
        squaredDist < pow((c1.radius + c2.radius), 2)
    );
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