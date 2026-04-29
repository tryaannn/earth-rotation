const mat4 = {
  create() {
    return new Float32Array([
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,1
    ]);
  },

  multiply(out, a, b) {
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3];
    const a10=a[4],a11=a[5],a12=a[6],a13=a[7];
    const a20=a[8],a21=a[9],a22=a[10],a23=a[11];
    const a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    let b0=b[0],b1=b[1],b2=b[2],b3=b[3];
    out[0]=b0*a00+b1*a10+b2*a20+b3*a30;
    out[1]=b0*a01+b1*a11+b2*a21+b3*a31;
    out[2]=b0*a02+b1*a12+b2*a22+b3*a32;
    out[3]=b0*a03+b1*a13+b2*a23+b3*a33;
    b0=b[4];b1=b[5];b2=b[6];b3=b[7];
    out[4]=b0*a00+b1*a10+b2*a20+b3*a30;
    out[5]=b0*a01+b1*a11+b2*a21+b3*a31;
    out[6]=b0*a02+b1*a12+b2*a22+b3*a32;
    out[7]=b0*a03+b1*a13+b2*a23+b3*a33;
    b0=b[8];b1=b[9];b2=b[10];b3=b[11];
    out[8]=b0*a00+b1*a10+b2*a20+b3*a30;
    out[9]=b0*a01+b1*a11+b2*a21+b3*a31;
    out[10]=b0*a02+b1*a12+b2*a22+b3*a32;
    out[11]=b0*a03+b1*a13+b2*a23+b3*a33;
    b0=b[12];b1=b[13];b2=b[14];b3=b[15];
    out[12]=b0*a00+b1*a10+b2*a20+b3*a30;
    out[13]=b0*a01+b1*a11+b2*a21+b3*a31;
    out[14]=b0*a02+b1*a12+b2*a22+b3*a32;
    out[15]=b0*a03+b1*a13+b2*a23+b3*a33;
    return out;
  },

  perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    out[0]=f/aspect; out[1]=0; out[2]=0; out[3]=0;
    out[4]=0; out[5]=f; out[6]=0; out[7]=0;
    out[8]=0; out[9]=0;
    out[10]=(far+near)/(near-far);
    out[11]=-1;
    out[12]=0; out[13]=0;
    out[14]=(2*far*near)/(near-far);
    out[15]=0;
    return out;
  },

  lookAt(out, eye, center, up) {
    let fx=center[0]-eye[0], fy=center[1]-eye[1], fz=center[2]-eye[2];
    let len=Math.sqrt(fx*fx+fy*fy+fz*fz);
    fx/=len; fy/=len; fz/=len;
    let sx=fy*up[2]-fz*up[1], sy=fz*up[0]-fx*up[2], sz=fx*up[1]-fy*up[0];
    len=Math.sqrt(sx*sx+sy*sy+sz*sz);
    sx/=len; sy/=len; sz/=len;
    const ux=sy*fz-sz*fy, uy=sz*fx-sx*fz, uz=sx*fy-sy*fx;
    out[0]=sx; out[1]=ux; out[2]=-fx; out[3]=0;
    out[4]=sy; out[5]=uy; out[6]=-fy; out[7]=0;
    out[8]=sz; out[9]=uz; out[10]=-fz; out[11]=0;
    out[12]=-(sx*eye[0]+sy*eye[1]+sz*eye[2]);
    out[13]=-(ux*eye[0]+uy*eye[1]+uz*eye[2]);
    out[14]= (fx*eye[0]+fy*eye[1]+fz*eye[2]);
    out[15]=1;
    return out;
  },

  rotateY(out, a, rad) {
    const s=Math.sin(rad), c=Math.cos(rad);
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3];
    const a20=a[8],a21=a[9],a22=a[10],a23=a[11];
    out[0]=a00*c-a20*s; out[1]=a01*c-a21*s; out[2]=a02*c-a22*s; out[3]=a03*c-a23*s;
    out[4]=a[4]; out[5]=a[5]; out[6]=a[6]; out[7]=a[7];
    out[8]=a00*s+a20*c; out[9]=a01*s+a21*c; out[10]=a02*s+a22*c; out[11]=a03*s+a23*c;
    out[12]=a[12]; out[13]=a[13]; out[14]=a[14]; out[15]=a[15];
    return out;
  },

  rotateZ(out, a, rad) {
    const s=Math.sin(rad), c=Math.cos(rad);
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3];
    const a10=a[4],a11=a[5],a12=a[6],a13=a[7];
    out[0]=a00*c+a10*s; out[1]=a01*c+a11*s; out[2]=a02*c+a12*s; out[3]=a03*c+a13*s;
    out[4]=a10*c-a00*s; out[5]=a11*c-a01*s; out[6]=a12*c-a02*s; out[7]=a13*c-a03*s;
    out[8]=a[8]; out[9]=a[9]; out[10]=a[10]; out[11]=a[11];
    out[12]=a[12]; out[13]=a[13]; out[14]=a[14]; out[15]=a[15];
    return out;
  },

  rotateX(out, a, rad) {
    const s=Math.sin(rad), c=Math.cos(rad);
    const a10=a[4],a11=a[5],a12=a[6],a13=a[7];
    const a20=a[8],a21=a[9],a22=a[10],a23=a[11];
    out[0]=a[0]; out[1]=a[1]; out[2]=a[2]; out[3]=a[3];
    out[4]=a10*c+a20*s; out[5]=a11*c+a21*s; out[6]=a12*c+a22*s; out[7]=a13*c+a23*s;
    out[8]=a20*c-a10*s; out[9]=a21*c-a11*s; out[10]=a22*c-a12*s; out[11]=a23*c-a13*s;
    out[12]=a[12]; out[13]=a[13]; out[14]=a[14]; out[15]=a[15];
    return out;
  },

  identity(out) {
    out[0]=1; out[1]=0; out[2]=0; out[3]=0;
    out[4]=0; out[5]=1; out[6]=0; out[7]=0;
    out[8]=0; out[9]=0; out[10]=1; out[11]=0;
    out[12]=0; out[13]=0; out[14]=0; out[15]=1;
    return out;
  },

  scale(out, a, v) {
    out[0]=a[0]*v[0]; out[1]=a[1]*v[0]; out[2]=a[2]*v[0]; out[3]=a[3]*v[0];
    out[4]=a[4]*v[1]; out[5]=a[5]*v[1]; out[6]=a[6]*v[1]; out[7]=a[7]*v[1];
    out[8]=a[8]*v[2]; out[9]=a[9]*v[2]; out[10]=a[10]*v[2]; out[11]=a[11]*v[2];
    out[12]=a[12]; out[13]=a[13]; out[14]=a[14]; out[15]=a[15];
    return out;
  },

  normalMatrix(out3, m) {
    // Extract upper-left 3x3 inverse transpose for normals
    const a00=m[0],a01=m[1],a02=m[2];
    const a10=m[4],a11=m[5],a12=m[6];
    const a20=m[8],a21=m[9],a22=m[10];
    const b01=a22*a11-a12*a21, b11=-a22*a10+a12*a20, b21=a21*a10-a11*a20;
    let det=a00*b01+a01*b11+a02*b21;
    if(!det) return null;
    det=1/det;
    out3[0]=b01*det; out3[1]=(-a22*a01+a02*a21)*det; out3[2]=(a12*a01-a02*a11)*det;
    out3[3]=b11*det; out3[4]=(a22*a00-a02*a20)*det; out3[5]=(-a12*a00+a02*a10)*det;
    out3[6]=b21*det; out3[7]=(-a21*a00+a01*a20)*det; out3[8]=(a11*a00-a01*a10)*det;
    return out3;
  }
};

const vec3 = {
  normalize(v) {
    const len = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
  },
  dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
};
