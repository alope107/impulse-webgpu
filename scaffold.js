export const defaults = {
    adapter: {
        powerPreference: "high-performance"
    },
    device: {}
};

const mergeSpec = (spec) => {
    const merged = {};
    for(const [attr, defaultVal] of Object.entries(defaults)) {
        merged.attr = {...defaultVal, ...spec.attr};
    }
    return merged;
};

export const createResources = async (spec, printPlan=false) => {
    const s = mergeSpec(spec);
    if (printPlan) console.log(s);

    const adapter = await navigator.gpu?.requestAdapter(s.adapter);
    const device = await adapter?.requestDevice(s.device);
    
    if(!device) {
        // Perhaps not the perfect error type, but will work for our purposes
        throw new Error("No WebGPU support");
    }

    return {adapter, device};
};

