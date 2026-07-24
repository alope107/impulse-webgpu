import { startResizeObservation } from "./resize.js";

export const defaults = {
    adapter: {
        powerPreference: "high-performance"
    },
    device: {},
    renderTarget: {
        initializer: () => {
            const renderTarget = document.body.appendChild(document.createElement("canvas"));
            renderTarget.id = "renderTarget";
            return renderTarget;
        },
        resizerInit: startResizeObservation, // will be passed {renderTarget, device}
    },
    renderTargetCtx: {
        alphaMode: "premultiplied"
    },
};

const mergeSpec = (spec) => {
    const merged = {};
    for(const [attr, defaultVal] of Object.entries(defaults)) {
        merged[attr] = spec[attr] == null ? null : {...defaultVal, ...spec.attr};
    }
    return merged;
};

export const createResources = async (spec, printPlan=false) => {
    const s = mergeSpec(spec);
    if (printPlan) {
        console.log("hey");
        console.log(s);
    }

    const adapter = await navigator.gpu?.requestAdapter(s.adapter);
    const device = await adapter?.requestDevice(s.device);
    
    if(!device) {
        // Perhaps not the perfect error type, but will work for our purposes
        throw new Error("No WebGPU support");
    }

    // These errors are automatically surfaced in the chrome terminal,
    // but need to be explicitly listened for on webkit
    device.addEventListener("uncapturederror", (e) => {
        console.error("Uncaptured error: ", e.error.message);
    });

    let renderTarget, renderFormat, renderTargetCtx;
    if(s.renderTarget !== null) {
        renderTarget  = s.renderTarget.initializer();
        if(s.renderTarget.resizerInit !== null) {
            s.renderTarget.resizerInit({canvas: renderTarget, device});
        }
        renderFormat = navigator.gpu.getPreferredCanvasFormat();
        renderTargetCtx = renderTarget.getContext("webgpu");
        renderTargetCtx.configure({
            device,
            format: renderFormat,
            ...s.renderTargetCtx,
        });
    }

    const out = {adapter, device, renderTarget, renderFormat, renderTargetCtx};

    if(printPlan) console.log(out);

    return out;
};

