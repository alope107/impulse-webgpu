import { global_invocation_index } from "./linear_indexing.js";
import { rectStruct, circleStruct, uniformsStruct, physStruct } from "./structs.js";

export const computeShaderCode = /* wgsl */ `
${global_invocation_index}

${physStruct.code}
${rectStruct.code}
${circleStruct.code}
${uniformsStruct.code}

struct Manifold {
    collisionNormal: vec2f,
    penetrationDepth: f32 
}

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
        rect.topLeft += rect.phys.velocity;
        rect.bottomRight += rect.phys.velocity;
}

// to pointer or not to pointer
fn calcJ(p1 : Phys, p2 : Phys, normal : vec2f) -> f32 {
    let e = min(p1.restitution, p2.restitution);
    let vRel = p2.velocity - p1.velocity;
    let velAlongNormal = dot(vRel, normal);
    return select(
        (-(1+e) * velAlongNormal) / (p1.invMass + p2.invMass),
        0,
        velAlongNormal > 0
    ); // do not apply impulse if they are already separating
}


// Firefox complains about these pointers :'(
// Argument 'r1' at index 0 is a pointer of space Storage { access: StorageAccess(LOAD | STORE) }, which can't be passed into functions.
// ..should prob give up on using pointer here
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

        // TODO: broad phase collision etc. etc.
        circle.overlaps = 0;
        for(var i = 0u; i < arrayLength(&circles); i++) {
            let other = &circles[i];
            let manifold = circleCollision(*circle, *other);
            let normal = manifold.collisionNormal;
            let collides = !all(normal == vec2f()) && id != i;
            circle.overlaps |= select(0u, 1u, collides);
            if(collides) { // TODO: branchless?
                let j = calcJ(circle.phys, other.phys, normal);
                circle.phys.velocity += -j * circle.phys.invMass * normal;
            }
        }

        for(var i = 0u; i < arrayLength(&rects); i++) {
            let rect = &rects[i];
            circle.overlaps |= select(0u, 1u, rectCircleOverlaps(rect, circle));
        }


        let pointerRadius=.05;
        if(uniforms.pointerHeld > 0) {
            let delta = circle.center - uniforms.pointerLoc;
            let deltaLen = length(delta);
            if(deltaLen < circle.radius+pointerRadius) {
                circle.phys.velocity += delta/10;
            }
        }

        circle.phys.velocity.y -= .0001;

        let maxSpeed = .1;
        let speed = length(circle.phys.velocity);
        if(speed > maxSpeed) {
            circle.phys.velocity *= maxSpeed/speed;
        }

        // TODO: Configurable / better base friction?
        circle.center += circle.phys.velocity*.9;

        if(circle.center.y < -1) {
            circle.center.y = -1;
            circle.phys.velocity.y *= -circle.phys.restitution;
        }
        if(circle.center.y > 1) {
            circle.center.y = 1;
            circle.phys.velocity.y *= -circle.phys.restitution;
        }
        if(circle.center.x < -1) {
            circle.center.x = -1;
            circle.phys.velocity.x *= -circle.phys.restitution;
        }
        if(circle.center.x > 1) {
            circle.center.x = 1;
            circle.phys.velocity.x *= -circle.phys.restitution;
        }
}

fn circleCollision(c1 : Circle, c2: Circle) -> Manifold {
    let delta = c2.center - c1.center;
    let squaredDist = dot(delta, delta);
    let touchingDist = c1.radius + c2.radius;
    if(squaredDist < pow(touchingDist, 2)) {
        let dist = sqrt(squaredDist);
        let penetrationDepth = touchingDist - dist;
        return Manifold(delta/dist, penetrationDepth);
    }
    return Manifold(vec2f(), 0);
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