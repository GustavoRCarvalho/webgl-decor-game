export const objs = [
    { id: "1", name: 'Cadeira', canvas: null, fileMTL: 'chair_A.mtl', fileOBJ: 'chair_A.obj' },
    { id: "2", name: 'Poltrona', canvas: null, fileMTL: 'armchair.mtl', fileOBJ: 'armchair.obj' },
    { id: "3", name: 'Poltrona 2', canvas: null, fileMTL: 'armchair_pillows.mtl', fileOBJ: 'armchair_pillows.obj' },
    { id: "4", name: 'Cama casal A', canvas: null, fileMTL: 'bed_double_A.mtl', fileOBJ: 'bed_double_A.obj' },
    { id: "5", name: 'Cama casal B', canvas: null, fileMTL: 'bed_double_B.mtl', fileOBJ: 'bed_double_B.obj' },
    { id: "6", name: 'Cama solteiro A', canvas: null, fileMTL: 'bed_single_A.mtl', fileOBJ: 'bed_single_A.obj' }
];

export const vertexShaderText =
    [
        'precision mediump float;',
        '',
        'attribute vec3 vertPosition;',
        'attribute vec2 vertTexCoord;',
        'varying vec2 fragTexCoord;',
        'uniform mat4 mWorld;',
        'uniform mat4 mView;',
        'uniform mat4 mProj;',
        '',
        'void main()',
        '{',
        '  fragTexCoord = vertTexCoord;',
        '  gl_Position = mProj * mView * mWorld * vec4(vertPosition, 1.0);',
        '}'
    ].join('\n');

export const fragmentShaderText =
    [
        'precision mediump float;',
        '',
        'varying vec2 fragTexCoord;',
        'uniform sampler2D sampler;',
        '',
        'void main()',
        '{',
        '  gl_FragColor = texture2D(sampler, fragTexCoord);',
        '}'
    ].join('\n');

export function parseOBJ(text) {
    // because indices are base 1 let's just fill in the 0th data
    const objPositions = [[0, 0, 0]];
    const objTexcoords = [[0, 0]];
    const objNormals = [[0, 0, 0]];
    const objColors = [[0, 0, 0]];

    // same order as `f` indices
    const objVertexData = [
        objPositions,
        objTexcoords,
        objNormals,
        objColors,
    ];

    // same order as `f` indices
    let webglVertexData = [
        [],   // positions
        [],   // texcoords
        [],   // normals
        [],   // colors
    ];

    const materialLibs = [];
    const geometries = [];
    let geometry;
    let groups = ['default'];
    let material = 'default';
    let object = 'default';

    const noop = () => { };

    function newGeometry() {
        // If there is an existing geometry and it's
        // not empty then start a new one.
        if (geometry && geometry.data.position.length) {
            geometry = undefined;
        }
    }

    function setGeometry() {
        if (!geometry) {
            const position = [];
            const texcoord = [];
            const normal = [];
            const color = [];
            webglVertexData = [
                position,
                texcoord,
                normal,
                color,
            ];
            geometry = {
                object,
                groups,
                material,
                data: {
                    position,
                    texcoord,
                    normal,
                    color,
                },
            };
            geometries.push(geometry);
        }
    }

    function addVertex(vert) {
        const ptn = vert.split('/');
        ptn.forEach((objIndexStr, i) => {
            if (!objIndexStr) {
                return;
            }
            const objIndex = parseInt(objIndexStr);
            const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
            webglVertexData[i].push(...objVertexData[i][index]);
            // if this is the position index (index 0) and we parsed
            // vertex colors then copy the vertex colors to the webgl vertex color data
            if (i === 0 && objColors.length > 1) {
                geometry.data.color.push(...objColors[index]);
            }
        });
    }

    const keywords = {
        v(parts) {
            // if there are more than 3 values here they are vertex colors
            if (parts.length > 3) {
                objPositions.push(parts.slice(0, 3).map(parseFloat));
                objColors.push(parts.slice(3).map(parseFloat));
            } else {
                objPositions.push(parts.map(parseFloat));
            }
        },
        vn(parts) {
            objNormals.push(parts.map(parseFloat));
        },
        vt(parts) {
            // should check for missing v and extra w?
            objTexcoords.push(parts.map(parseFloat));
        },
        f(parts) {
            setGeometry();
            const numTriangles = parts.length - 2;
            for (let tri = 0; tri < numTriangles; ++tri) {
                addVertex(parts[0]);
                addVertex(parts[tri + 1]);
                addVertex(parts[tri + 2]);
            }
        },
        s: noop,    // smoothing group
        mtllib(parts, unparsedArgs) {
            // the spec says there can be multiple filenames here
            // but many exist with spaces in a single filename
            materialLibs.push(unparsedArgs);
        },
        usemtl(parts, unparsedArgs) {
            material = unparsedArgs;
            newGeometry();
        },
        g(parts) {
            groups = parts;
            newGeometry();
        },
        o(parts, unparsedArgs) {
            object = unparsedArgs;
            newGeometry();
        },
    };

    const keywordRE = /(\w*)(?: )*(.*)/;
    const lines = text.split('\n');
    for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
        const line = lines[lineNo].trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        const m = keywordRE.exec(line);
        if (!m) {
            continue;
        }
        const [, keyword, unparsedArgs] = m;
        const parts = line.split(/\s+/).slice(1);
        const handler = keywords[keyword];
        if (!handler) {
            console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
            continue;
        }
        handler(parts, unparsedArgs);
    }

    // remove any arrays that have no entries.
    for (const geometry of geometries) {
        geometry.data = Object.fromEntries(
            Object.entries(geometry.data).filter(([, array]) => array.length > 0));
    }

    return {
        geometries,
        materialLibs,
    };
}

export function parseMapArgs(unparsedArgs) {
    // TODO: handle options
    return unparsedArgs;
}

export function parseMTL(text) {
    const materials = {};
    let material;

    const keywords = {
        newmtl(parts, unparsedArgs) {
            material = {};
            materials[unparsedArgs] = material;
        },
        /* eslint brace-style:0 */
        Ns(parts) { material.shininess = parseFloat(parts[0]); },
        Ka(parts) { material.ambient = parts.map(parseFloat); },
        Kd(parts) { material.diffuse = parts.map(parseFloat); },
        Ks(parts) { material.specular = parts.map(parseFloat); },
        Ke(parts) { material.emissive = parts.map(parseFloat); },
        map_Kd(parts, unparsedArgs) { material.diffuseMap = parseMapArgs(unparsedArgs); },
        map_Ns(parts, unparsedArgs) { material.specularMap = parseMapArgs(unparsedArgs); },
        map_Bump(parts, unparsedArgs) { material.normalMap = parseMapArgs(unparsedArgs); },
        Ni(parts) { material.opticalDensity = parseFloat(parts[0]); },
        d(parts) { material.opacity = parseFloat(parts[0]); },
        illum(parts) { material.illum = parseInt(parts[0]); },
    };

    const keywordRE = /(\w*)(?: )*(.*)/;
    const lines = text.split('\n');
    for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
        const line = lines[lineNo].trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        const m = keywordRE.exec(line);
        if (!m) {
            continue;
        }
        const [, keyword, unparsedArgs] = m;
        const parts = line.split(/\s+/).slice(1);
        const handler = keywords[keyword];
        if (!handler) {
            console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
            continue;
        }
        handler(parts, unparsedArgs);
    }

    return materials;
}

export function makeIndexedIndicesFn(arrays) {
    const indices = arrays.indices;
    let ndx = 0;
    const fn = function () {
        return indices[ndx++];
    };
    fn.reset = function () {
        ndx = 0;
    };
    fn.numElements = indices.length;
    return fn;
}

export const vs = `#version 300 es
        in vec4 a_position;
        in vec3 a_normal;
        in vec2 a_texcoord;
        in vec4 a_color;
      
        uniform mat4 u_projection;
        uniform mat4 u_view;
        uniform mat4 u_world;
        uniform vec3 u_viewWorldPosition;
      
        out vec3 v_normal;
        out vec3 v_surfaceToView;
        out vec2 v_texcoord;
        out vec4 v_color;
      
        void main() {
          vec4 worldPosition = u_world * a_position;
          gl_Position = u_projection * u_view * worldPosition;
          v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
          v_normal = mat3(u_world) * a_normal;
          v_texcoord = a_texcoord;
          v_color = a_color;
        }
        `;

export const fs = `#version 300 es
        precision highp float;
      
        in vec3 v_normal;
        in vec3 v_surfaceToView;
        in vec2 v_texcoord;
        in vec4 v_color;
      
        uniform vec3 diffuse;
        uniform sampler2D diffuseMap;
        uniform vec3 ambient;
        uniform vec3 emissive;
        uniform vec3 specular;
        uniform sampler2D specularMap;
        uniform float shininess;
        uniform float opacity;
        uniform vec3 u_lightDirection;
        uniform vec3 u_ambientLight;
      
        out vec4 outColor;
      
        void main () {
          vec3 normal = normalize(v_normal);
      
          vec3 surfaceToViewDirection = normalize(v_surfaceToView);
          vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);
      
          float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
          float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
          vec4 specularMapColor = texture(specularMap, v_texcoord);
          vec3 effectiveSpecular = specular * specularMapColor.rgb;
      
          vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
          vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
          float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;
      
          outColor = vec4(
              emissive +
              ambient * u_ambientLight +
              effectiveDiffuse * fakeLight +
              effectiveSpecular * pow(specularLight, shininess),
              effectiveOpacity);
        }
        `;

export async function loadFileContent(filePath) {
    try {
        const response = await fetch(filePath);
        return await response.text();
    } catch (error) {
        console.error(`Erro ao carregar o arquivo ${filePath}:`, error);
        return null;
    }
}

export function getExtents(positions) {
    const min = positions.slice(0, 3);
    const max = positions.slice(0, 3);
    for (let i = 3; i < positions.length; i += 3) {
        for (let j = 0; j < 3; ++j) {
            const v = positions[i + j];
            min[j] = Math.min(v, min[j]);
            max[j] = Math.max(v, max[j]);
        }
    }
    return { min, max };
}

export function getGeometriesExtents(geometries) {
    return geometries.reduce(({ min, max }, { data }) => {
        const minMax = getExtents(data.position);
        return {
            min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
            max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
        };
    }, {
        min: Array(3).fill(Number.POSITIVE_INFINITY),
        max: Array(3).fill(Number.NEGATIVE_INFINITY),
    });
}

export function degToRad(deg) {
    return deg * Math.PI / 180;
}

export const objPath = './assets/KayKit_Furniture_Bits_1.0_FREE/Assets/obj';
export const mtlPath = './assets/KayKit_Furniture_Bits_1.0_FREE/Assets/obj';
export const texturePath = './assets/KayKit_Furniture_Bits_1.0_FREE/Assets/texture/furniturebits_texture.png';