import { global_invocation_index } from "./linear_indexing.js";
import { rectStruct, circleStruct, uniformsStruct } from "./structs.js";

export const computeShaderCode = /* wgsl */ `
${global_invocation_index}

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
}
`;