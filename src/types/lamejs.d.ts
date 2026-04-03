declare module "lamejs" {
  type Mp3Encoder = {
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  }

  type Mp3EncoderConstructor = {
    new (channels: number, sampleRate: number, bitRate: number): Mp3Encoder;
  }

  const lamejs: {
    Mp3Encoder: Mp3EncoderConstructor;
  };
  export default lamejs;
}
