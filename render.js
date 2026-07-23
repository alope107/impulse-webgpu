import { rectStruct } from "./structs.js";

export const renderShaderCode = /* wgsl */ `
${rectStruct.code}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) color : vec4f
}

@group(0) @binding(0) var<storage, read> rects : array<Rect>; 

@vertex fn drawRects(@builtin(vertex_index) vertexIdx : u32, 
                    @builtin(instance_index) instanceIdx : u32) -> VertexOutput {
    let rect = rects[instanceIdx];
    let points = array(
        rect.topLeft,
        vec2f(rect.topLeft.x, rect.bottomRight.y),
        vec2f(rect.bottomRight.x, rect.topLeft.y),
        rect.bottomRight
    );
    return VertexOutput(
        vec4f(points[vertexIdx], 1, 1),
        vec4f(1, 1, 0, 1)
    );
}

@fragment fn solidColor(fragInput : VertexOutput) -> @location(0) vec4f {
    // Precomputed alpha blending (would technically be better to pre-do in struct)
    return vec4f(fragInput.color.rgb*fragInput.color.a, fragInput.color.a);
}
`;