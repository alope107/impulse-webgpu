import { global_invocation_index } from "./linear_indexing.js";
import { rectStruct, uniformsStruct } from "./structs.js";

export const computeShaderCode = /* wgsl */ `
${global_invocation_index}

${rectStruct.code}
${uniformsStruct.code}

@group(0) @binding(0) var<storage, read_write> rects : array<Rect>; 
@group(0) @binding(1) var<uniform> uniforms : Uniforms;

// TODO: better workgroup size UPDATE THE GLOBAL INDEX CALC IF CHANGED
@compute @workgroup_size(8, 8, 1) fn moveRects(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(num_workgroups) num_workgroups: vec3<u32>) {
        let id = global_invocation_index(workgroup_id, local_invocation_index, num_workgroups,
                                         8*8*1 /* CHANGE ME WHEN WORKGROUP SIZE CHANGES */);
        if(id >= arrayLength(&rects)) { return; }

        // Just making sure we don't lose our bindings
        _ = rects[0].topLeft;
        _ = uniforms.pointerHeld;
    }
`;