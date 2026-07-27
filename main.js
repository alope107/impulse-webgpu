import { computeShaderCode } from "./compute.js";
import { configFromQueryParams } from "./config.js";
import { renderShaderCode } from "./render.js";
import { startResizeObservation } from "./resize.js";
import { rectStruct, circleStruct, uniformsStruct } from "./structs.js";

let pointerLoc = [0, 0];
let pointerHeldNow = false;
let pointerHeldLastFrame = false;

const main = async () => {

    // TODO check for max supported first
    const device = await (await navigator.gpu?.requestAdapter( {
        powerPreference: "high-performance",
    }))?.requestDevice();

    if(!device) {        
        const errorMessage = document.body.appendChild(document.createElement("span"));
        errorMessage.innerText = "No WebGPU support :( "
        console.error("No WebGPU support :(");
        return;
    }

    const c = configFromQueryParams();

    const renderTarget = document.body.appendChild(document.createElement("canvas"));
    renderTarget.id = "renderTarget";

    startResizeObservation(renderTarget,  device.limits.maxTextureDimension2D);

    // These errors are automatically surfaced in the chrome terminal,
    // but need to be explicitly listened for on webkit
    device.addEventListener("uncapturederror", (e) => {
        console.error("Uncaptured error: ", e.error.message);
    });

    const renderFormat = navigator.gpu.getPreferredCanvasFormat();
    const ctx = renderTarget.getContext("webgpu");
    ctx.configure( {
        device,
        format: renderFormat,
        alphaMode: "premultiplied"
    });

    const computeModule = device.createShaderModule({
        label: "compute shader module",
        code:computeShaderCode
    });
    const moveRectsPipeline = device.createComputePipeline({
        label: "moveRects pipeline",
        layout: "auto",
        compute: {
            module: computeModule,
            entryPoint: "moveRects"
        }
    });
    const moveCirclesPipeline = device.createComputePipeline({
        label: "moveCircles pipeline",
        layout: "auto",
        compute: {
            module: computeModule,
            entryPoint: "moveCircles"
        }
    });

    const renderModule = device.createShaderModule({
        label: "render module",
        code: renderShaderCode(c.polysPerCircle)
    });
    const rectRenderPipeline = device.createRenderPipeline({
        label: "rect render pipeline",
        layout: "auto",
        vertex: {
            entryPoint: "drawRect",
            module: renderModule
        },
        fragment:{
            entryPoint: "solidColor",
            module: renderModule,
            targets: [{format: renderFormat}]
        },
        primitive: {
            topology: "triangle-strip"
        }
    });
    // TODO: less copypasta
    const circleRenderPipeline = device.createRenderPipeline({
        label: "circle render pipeline",
        layout: "auto",
        vertex: {
            entryPoint: "drawCircle",
            module: renderModule
        },
        fragment:{
            entryPoint: "solidColor",
            module: renderModule,
            targets: [{format: renderFormat}]
        },
        primitive: {
            topology: "triangle-strip"
        }
    });
    const baseRenderPassDescriptor = {
        label: "base render pass descriptor",
        colorAttachments: [
            {
                clearValue: [0, 0, 0, 1],
                loadOp: "clear",
                storeOp: "store"
            }
        ]
    };
    const layeredRenderPassDescriptor = {
        label: "layered render pass descriptor",
        colorAttachments: [
            {
                loadOp: "load",
                storeOp: "store"
            }
        ]
    };

    const rects = rectStruct.createFilledArray(
        rectStruct.randomJSRects(c.rectCount, c.minRectWidth, c.maxRectWidth, c.maxRandVelComp, c.density, c.restitution)
    );
    // TODO: double buffer?
    const rectBuffer = device.createBuffer({
        label: "rectBuffer",
        size: rects.data.byteLength,
        usage: GPUBufferUsage.STORAGE |
               GPUBufferUsage.COPY_DST |
            //    GPUBufferUsage.COPY_SRC | // used for debugging
               GPUBufferUsage.VERTEX
    });
    device.queue.writeBuffer(rectBuffer, 0, rects.data);

    const circles = circleStruct.createFilledArray(
        circleStruct.randJSCircles(c.circleCount, c.minCircleRadius, c.maxCircleRadius, c.maxRandVelComp)
    );

    // TODO: double buffer?
    const circleBuffer = device.createBuffer({
        label: "circleBuffer",
        size: circles.data.byteLength,
        usage: GPUBufferUsage.STORAGE |
               GPUBufferUsage.COPY_DST |
            //    GPUBufferUsage.COPY_SRC | // used for debugging
               GPUBufferUsage.VERTEX
    });
    device.queue.writeBuffer(circleBuffer, 0, circles.data);


    let uniform = uniformsStruct.createFilled({
        pointerLoc: [0, 0],
        pointerHeld: 0,
        pointerPressed: 0
    });
    const uniformBuffer = device.createBuffer({
        label: "uniform buffer",
        size: uniform.data.byteLength,
        usage: GPUBufferUsage.UNIFORM | 
               GPUBufferUsage.COPY_DST 
    });

    const moveRectsBindGroup = device.createBindGroup({
        label: "moveRectsBindGroup",
        layout: moveRectsPipeline.getBindGroupLayout(0),
        entries: [
            {binding: 0, resource: uniformBuffer},
            {binding: 1, resource: rectBuffer},
            {binding: 2, resource: circleBuffer},
        ]
    });
    const renderRectsBindGroup = device.createBindGroup({
        label: "renderRectsBindGroup",
        layout: rectRenderPipeline.getBindGroupLayout(0),
        entries: [
            {binding: 0, resource: rectBuffer},
            {binding: 1, resource: circleBuffer},
        ]
    });

    const moveCirclesBindGroup = device.createBindGroup({
        label: "moveCirclesBindGroup",
        layout: moveCirclesPipeline.getBindGroupLayout(0),
        entries: [
            {binding: 0, resource: uniformBuffer},
            {binding: 1, resource: rectBuffer},
            {binding: 2, resource: circleBuffer},
        ]
    });
    const renderCirclesBindGroup = device.createBindGroup({
        label: "renderCirclesBindGroup",
        layout: circleRenderPipeline.getBindGroupLayout(0),
        entries: [
            {binding: 0, resource: rectBuffer},
            {binding: 1, resource: circleBuffer},
        ]
    });

    

    renderTarget.addEventListener("pointermove", () => {
        // Rescale to clip space, the scaling used by the compute/vertex shaders
        pointerLoc = [(2 * event.clientX / renderTarget.width) - 1, -((2 * event.clientY / renderTarget.height) - 1)];
    });
    renderTarget.addEventListener('pointerdown', () => { pointerHeldNow = 1; });
    renderTarget.addEventListener('pointerup', () => { pointerHeldNow = 0; });
    renderTarget.addEventListener('pointeleave', () => { pointerHeldNow = 0; });
    renderTarget.addEventListener('pointercancel', () => { pointerHeldNow = 0; });


    let frameCount = 0;
    const render = async() => {
        const encoder = device.createCommandEncoder({label: "encoder"});

        let moveRectsPass = encoder.beginComputePass();
        moveRectsPass.setPipeline(moveRectsPipeline);
        moveRectsPass.setBindGroup(0, moveRectsBindGroup);
        moveRectsPass.dispatchWorkgroups(Math.ceil(rects.count/64), Math.ceil(rects.count/64), 1);
        moveRectsPass.end();

        let moveCirclesPass = encoder.beginComputePass();
        moveCirclesPass.setPipeline(moveCirclesPipeline);
        moveCirclesPass.setBindGroup(0, moveCirclesBindGroup);
        moveCirclesPass.dispatchWorkgroups(Math.ceil(circles.count/64), Math.ceil(circles.count/64), 1);
        moveCirclesPass.end();

        baseRenderPassDescriptor.colorAttachments[0].view = ctx.getCurrentTexture().createView();
        const rectRenderPass = encoder.beginRenderPass(baseRenderPassDescriptor);
        rectRenderPass.setPipeline(rectRenderPipeline);
        rectRenderPass.setBindGroup(0, renderRectsBindGroup);
        rectRenderPass.draw(4, rects.count); // Rectangle needs 4 vertices
        rectRenderPass.end();

        layeredRenderPassDescriptor.colorAttachments[0].view = ctx.getCurrentTexture().createView();
        const circleRenderPass = encoder.beginRenderPass(layeredRenderPassDescriptor);
        circleRenderPass.setPipeline(circleRenderPipeline);
        circleRenderPass.setBindGroup(0, renderCirclesBindGroup);
        circleRenderPass.draw(c.polysPerCircle*2 + 1, circles.count); 
        circleRenderPass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
        frameCount++;
    };

    const animationFrame = async (timestamp) => {
        uniform = uniformsStruct.createFilled({
            gravity: [0, 0],
            pointerLoc: pointerLoc,
            pointerHeld: pointerHeldNow,
            pointerPressed: !pointerHeldLastFrame && pointerHeldNow 
        });
        pointerHeldLastFrame = pointerHeldNow;
        device.queue.writeBuffer(uniformBuffer, 0, uniform.data);
        render();
        requestAnimationFrame(animationFrame);
    };
    requestAnimationFrame(animationFrame);
};

main();