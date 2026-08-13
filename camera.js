// TODO: rotate, translate
const buildCamera = ([scaleX, scaleY]) => {
    return [
        [scaleX, 0,      0],
        [0,      scaleY, 0],
        [0,      0,      1]
    ];
};

export default buildCamera;