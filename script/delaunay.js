// Generated by CoffeeScript 1.7.1

/* ----------------------------------------------------------------------------
The MIT License (MIT)

Copyright (c) 2014 Nandor Licker

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
----------------------------------------------------------------------------
 */


/*
  OpenGL shader object wrapper
 */

(function() {
  var Delaunay, PointSet, Shader;

  Shader = (function() {

    /*
      Creates a new shader, retrieving source code from script tags
      that have the same class name as the name of this shader
      @param {WebGLRenderingContext} gl OpenGL context
      @param {String} name              Name of the shader
      @throws If a source file is invalid, compilation fails or linking fails
     */
    function Shader(gl, name) {
      this.gl = gl;
      this.name = name;
      this.prog = this.gl.createProgram();
      this.unifs = {};
      this.attribs = {};
      $("script." + this.name).each((function(_this) {
        return function(idx, src) {
          var type;
          type = $(src).attr("type");
          switch (type) {
            case "x-shader/x-fragment":
              return _this.compile(src.text, _this.gl.FRAGMENT_SHADER);
            case "x-shader/x-vertex":
              return _this.compile(src.text, _this.gl.VERTEX_SHADER);
            default:
              throw new Error("Invalid shader type '" + type + "'");
          }
        };
      })(this));
      this.link();
    }


    /*
      Compiles a single shader source file
      @param {String} src  Source code
      @param {Number} type Type of shader
      @throws If compilation fails
     */

    Shader.prototype.compile = function(src, type) {
      var sh;
      sh = this.gl.createShader(type);
      this.gl.shaderSource(sh, src);
      this.gl.compileShader(sh);
      if (!this.gl.getShaderParameter(sh, this.gl.COMPILE_STATUS)) {
        throw new Error(this.gl.getShaderInfoLog(sh));
      }
      return this.gl.attachShader(this.prog, sh);
    };


    /*
      Links a shader program
      @throw If linking fails
     */

    Shader.prototype.link = function() {
      var attrib, count, i, unif, _i, _j, _ref, _ref1, _results;
      this.gl.bindAttribLocation(this.prog, 0, "in_vertex");
      this.gl.bindAttribLocation(this.prog, 1, "in_color");
      this.gl.bindAttribLocation(this.prog, 2, "in_normal");
      this.gl.bindAttribLocation(this.prog, 3, "in_uv");
      this.gl.linkProgram(this.prog);
      if (!this.gl.getProgramParameter(this.prog, this.gl.LINK_STATUS)) {
        throw new Error(this.gl.getProgramInfoLog(this.prog));
      }
      count = this.gl.getProgramParameter(this.prog, this.gl.ACTIVE_UNIFORMS);
      for (i = _i = 0, _ref = count - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
        unif = this.gl.getActiveUniform(this.prog, i);
        this.unifs[unif.name] = {
          loc: this.gl.getUniformLocation(this.prog, unif.name),
          type: unif.type
        };
      }
      count = this.gl.getProgramParameter(this.prog, this.gl.ACTIVE_ATTRIBUTES);
      _results = [];
      for (i = _j = 0, _ref1 = count - 1; 0 <= _ref1 ? _j <= _ref1 : _j >= _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
        attrib = this.gl.getActiveAttrib(this.prog, i);
        _results.push(this.attribs[attrib.name] = this.gl.getActiveAttrib(this.prog, attrib.name));
      }
      return _results;
    };


    /*
      Binds the program to the context
     */

    Shader.prototype.use = function() {
      return this.gl.useProgram(this.prog);
    };


    /*
      Sets the value of a uniform parameter
      @param {String} name  Name of the uniform
      @param {Object} value Actual value
     */

    Shader.prototype.uniform = function(name, value) {
      if (!(name in this.unifs)) {
        return;
      }
      switch (this.unifs[name].type) {
        case this.gl.FLOAT_MAT4:
          if (!(value instanceof Float32Array && value.length === 16)) {
            throw new Error("Invalid uniform value, expected mat4");
          }
          return this.gl.uniformMatrix4fv(this.unifs[name].loc, false, value);
        case this.gl.INT:
          if (!(value instanceof Number && value % 1 === 0)) {
            throw new Error("Invalid uniform value, expected integer");
          }
          return this.gl.uniform1i(this.unifs[name].loc, value);
        case this.gl.FLOAT:
          if (!(value instanceof NUmber)) {
            throw new Error("Invalid uniform value, expected float");
          }
          return this.gl.uniform1f(this.unifs[name].loc, value);
      }
    };

    return Shader;

  })();

  PointSet = (function() {

    /*
      Creates a new set which will manage the points of interest
      @param {WebGLRenderingContext} gl
     */
    function PointSet(gl) {
      this.gl = gl;
      this.points = [];
      this.lines = [];
      this.trgs = [];
      this.data = this.gl.createBuffer();
      this.idxLines = this.gl.createBuffer();
      this.idxTrgs = this.gl.createBuffer();
    }


    /*
      Adds a new point to the existing set
     */

    PointSet.prototype.addPoint = function(x, y) {
      var point;
      point = {
        x: x,
        y: y,
        i: Math.random(),
        selected: true
      };
      this.points.push(point);
      this.triangulate();
      this.genBuffer();
      return point;
    };


    /*
      Uploads the update buffers & indices
     */

    PointSet.prototype.genBuffer = function() {
      var arr, i, point, _i, _len, _ref, _ref1;
      arr = new Float32Array(this.points.length * 4);
      _ref = this.points;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        point = _ref[i];
        arr[(i << 2) + 0] = point.x;
        arr[(i << 2) + 1] = point.y;
        arr[(i << 2) + 2] = point.i;
        arr[(i << 2) + 3] = (_ref1 = point.selected) != null ? _ref1 : {
          1.0: 0.0
        };
      }
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.data);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, arr, this.gl.STATIC_DRAW);
      return this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    };


    /*
      Performs the Delaunay triangulation
     */

    PointSet.prototype.triangulate = function() {
      var divide, _i, _ref, _results;
      divide = (function(_this) {
        return function(pts) {
          var left, right, x, _i, _len;
          switch (pts.length) {
            case 0:
              return [];
            case 1:
              return [pts];
            case 2:
              _this.lines.push(pts[0]);
              _this.lines.push(pts[1]);
              return [pts];
            case 3:
              _this.lines.push(pts[0]);
              _this.lines.push(pts[1]);
              _this.lines.push(pts[1]);
              _this.lines.push(pts[2]);
              _this.lines.push(pts[2]);
              _this.lines.push(pts[0]);
              _this.trgs.push(pts[0]);
              _this.trgs.push(pts[1]);
              _this.trgs.push(pts[2]);
              return [pts];
            default:
              left = divide(pts.slice(0, (pts.length >> 1) + 1));
              right = divide(pts.slice((pts.length >> 1) + 1, pts.length));
              for (_i = 0, _len = right.length; _i < _len; _i++) {
                x = right[_i];
                left.push(x);
              }
              return left;
          }
        };
      })(this);
      this.lines = [];
      this.trgs = [];
      divide((function() {
        _results = [];
        for (var _i = 0, _ref = this.points.length - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; 0 <= _ref ? _i++ : _i--){ _results.push(_i); }
        return _results;
      }).apply(this).sort((function(_this) {
        return function(i, j) {
          var d;
          d = _this.points[i].x - _this.points[j].x;
          if (d !== 0) {
            return d;
          } else {
            return _this.points[i].y - _this.points[j].y;
          }
        };
      })(this)));
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.idxLines);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.lines), this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.idxTrgs);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.trgs), this.gl.STATIC_DRAW);
      return this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
    };


    /*
      Returns the number of points in the set
     */

    PointSet.prototype.getPointCount = function() {
      return this.points.length;
    };


    /*
      Returns the number of triangles
     */

    PointSet.prototype.getTriangleCount = function() {
      return this.trgs.length;
    };


    /*
      Returns the number of lines joining the points
     */

    PointSet.prototype.getLineCount = function() {
      return this.lines.length;
    };

    return PointSet;

  })();

  Delaunay = (function() {
    function Delaunay() {
      var err, glNames, gradient, i, _i, _len;
      this.parent = $("#canvas");
      this.canvas = $("canvas", this.parent).get(0);
      glNames = ["webgl", "experimental-webgl"];
      for (_i = 0, _len = glNames.length; _i < _len; _i++) {
        i = glNames[_i];
        try {
          this.gl = this.canvas.getContext(i);
        } catch (_error) {
          err = _error;
          continue;
        }
        if (!this.gl) {
          break;
        }
      }
      if (!this.gl) {
        throw new Error("Cannot create WebGL context");
      }
      this.shTrgs = new Shader(this.gl, "trgs");
      this.shPoints = new Shader(this.gl, "points");
      this.shLines = new Shader(this.gl, "lines");
      this.set = new PointSet(this.gl);
      gradient = new Uint8Array([0, 0, 127, 255, 0, 0, 255, 255, 0, 63, 255, 255, 0, 127, 255, 255, 0, 191, 255, 255, 0, 255, 255, 255, 63, 255, 191, 255, 127, 255, 127, 255, 191, 255, 63, 255, 255, 255, 0, 255, 255, 191, 0, 255, 255, 127, 0, 255, 255, 63, 0, 255, 255, 0, 0, 255, 191, 0, 0, 255, 127, 0, 0, 255]);
      this.gradient = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.gradient);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 16, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, gradient);
      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
      this.parent.bind('mousedown', (function(_this) {
        return function(e) {
          var point, sel, _j, _k, _len1, _len2, _ref, _ref1;
          sel = null;
          _ref = _this.set.points;
          for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
            point = _ref[_j];
            point.selected = false;
          }
          _ref1 = _this.set.points;
          for (_k = 0, _len2 = _ref1.length; _k < _len2; _k++) {
            point = _ref1[_k];
            if (Math.abs(e.pageX - point.x) <= 5 && Math.abs(e.pageY - point.y) <= 5) {
              point.selected = true;
              sel = point;
              break;
            }
          }
          if (!sel) {
            sel = _this.set.addPoint(e.pageX, e.pageY);
            _this.set.genBuffer();
          }
          _this.set.genBuffer();
          _this.parent.bind('mousemove', function(e) {
            sel.x = e.pageX;
            sel.y = e.pageY;
            return _this.set.genBuffer();
          });
          _this.parent.bind('mouseup', function(e) {
            return _this.parent.unbind('mousemove mouseup');
          });
          return e.preventDefault();
        };
      })(this));
      this.loop();
    }

    Delaunay.prototype.render = function() {
      var h, proj, view, w;
      w = this.canvas.width = this.parent.width();
      h = this.canvas.height = this.parent.height();
      this.gl.viewport(0, 0, w, h);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      proj = mat4.ortho(mat4.create(), 0, w, h, 0, -1, 1);
      view = mat4.identity(mat4.create());
      this.gl.enableVertexAttribArray(0);
      this.shPoints.use();
      this.shPoints.uniform("u_proj", proj);
      this.shPoints.uniform("u_view", view);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.set.data);
      this.gl.vertexAttribPointer(0, 4, this.gl.FLOAT, false, 16, 0);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
      this.gl.drawArrays(this.gl.POINTS, 0, this.set.getPointCount());
      this.shLines.use();
      this.shLines.uniform("u_proj", proj);
      this.shLines.uniform("u_view", view);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.set.data);
      this.gl.vertexAttribPointer(0, 4, this.gl.FLOAT, false, 16, 0);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.set.idxLines);
      this.gl.drawElements(this.gl.LINES, this.set.getLineCount(), this.gl.UNSIGNED_SHORT, 0);
      this.shTrgs.use();
      this.shTrgs.uniform("u_proj", proj);
      this.shTrgs.uniform("u_view", view);
      this.shTrgs.uniform("u_gradient", 0);
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.gradient);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.set.data);
      this.gl.vertexAttribPointer(0, 4, this.gl.FLOAT, false, 16, 0);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.set.idxTrgs);
      this.gl.drawElements(this.gl.TRIANGLES, this.set.getTriangleCount(), this.gl.UNSIGNED_SHORT, 0);
      return this.gl.disableVertexAttribArray(0);
    };

    Delaunay.prototype.loop = function() {
      this.render();
      return window.requestAnimationFrame((function(_this) {
        return function() {
          return _this.loop();
        };
      })(this));
    };

    return Delaunay;

  })();

  $(function() {
    return new Delaunay();
  });

}).call(this);
