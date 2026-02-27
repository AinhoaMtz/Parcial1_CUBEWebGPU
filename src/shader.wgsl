@group(0) @binding(0) var<uniform> mvp: mat4x4<f32>;
@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_2d<f32>;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv:       vec2<f32>,
  @location(2) color:    vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) uv:    vec2<f32>,
  @location(1) color: vec3<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.clip_position = mvp * vec4<f32>(in.position, 1.0);
  out.uv            = in.uv;
  out.color         = in.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let texColor = textureSample(myTexture, mySampler, in.uv);
  return vec4<f32>(texColor.rgb * in.color, texColor.a);
}
