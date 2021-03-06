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
    var Edge, self;

    self = {};

    Edge = (function() {

      /* Creates a new quad edge */
      var EdgeView;

      function Edge(set) {
        this.set = set;
        this.e = [0, 1, 2, 3].map((function(_this) {
          return function(i) {
            var e;
            e = new EdgeView(_this.set);
            e.idx = i;
            e.id = self.id++;
            e.edge = _this;
            return e;
          };
        })(this));
        this.e[0].next = this.e[0];
        this.e[1].next = this.e[3];
        this.e[2].next = this.e[2];
        this.e[3].next = this.e[1];
      }

      EdgeView = (function() {

        /* Creates a new edge inside the quad edge */
        function EdgeView() {
          this.vertex = -1;
        }


        /* Rotates the edge CW */

        EdgeView.prototype.rot = function() {
          return this.edge.e[(this.idx + 1) & 3];
        };

        EdgeView.prototype.invRot = function() {
          return this.edge.e[(this.idx + 3) & 3];
        };


        /* Returns the symmetric edge */

        EdgeView.prototype.sym = function() {
          return this.edge.e[(this.idx + 2) & 3];
        };


        /* Returns the next edge */

        EdgeView.prototype.oNext = function() {
          return this.next;
        };

        EdgeView.prototype.dNext = function() {
          return this.sym().oNext().sym();
        };

        EdgeView.prototype.lNext = function() {
          return this.invRot().oNext().rot();
        };

        EdgeView.prototype.rNext = function() {
          return this.rot().oNext().invRot();
        };


        /* Returns the previous edge */

        EdgeView.prototype.oPrev = function() {
          return this.rot().oNext().rot();
        };

        EdgeView.prototype.dPrev = function() {
          return this.invRot().oNext().invRot();
        };

        EdgeView.prototype.lPrev = function() {
          return this.oNext().sym();
        };

        EdgeView.prototype.rPrev = function() {
          return this.sym().oNext();
        };


        /* Returns the endpoints */

        EdgeView.prototype.org = function(v) {
          if (v != null) {
            this.vertex = v;
          }
          return this.vertex;
        };

        EdgeView.prototype.dest = function(v) {
          return this.sym().org(v);
        };


        /* Returns the attached faces */

        EdgeView.prototype.left = function(f) {
          if (f != null) {
            this.rot().face = f;
          }
          return this.rot().face;
        };

        EdgeView.prototype.right = function(f) {
          if (f != null) {
            this.invRot().face = f;
          }
          return this.invRot().face;
        };

        return EdgeView;

      })();

      return Edge;

    })();


    /*
      Creates a new set which will manage the points of interest
      @param {WebGLRenderingContext} gl
     */

    function PointSet(gl) {
      this.gl = gl;
      self = this;
      this.pts = [];
      this.lines = [];
      this.trgs = [];
      this.id = 0;
      this.data = this.gl.createBuffer();
      this.idxLines = this.gl.createBuffer();
      this.idxTrgs = this.gl.createBuffer();
    }


    /*
      Creates a new edge
      @return {EdgeView}
     */

    PointSet.prototype.makeEdge = function() {
      return (new Edge()).e[0];
    };


    /*
      Splices two edges
     */

    PointSet.prototype.splice = function(a, b) {
      var alpha, alphan, an, beta, betan, bn;
      alpha = a.oNext().rot();
      beta = b.oNext().rot();
      an = a.oNext();
      bn = b.oNext();
      alphan = alpha.oNext();
      betan = beta.oNext();
      a.next = bn;
      b.next = an;
      alpha.next = betan;
      return beta.next = alphan;
    };


    /*
      Creates a new edge connecting the endpoints of
      an existing edge
     */

    PointSet.prototype.connect = function(a, b, side) {
      var e;
      e = this.makeEdge();
      e.org(a.dest());
      e.dest(b.org());
      this.splice(e, a.lNext());
      this.splice(e.sym(), b);
      return e;
    };


    /*
      Removes an edge
     */

    PointSet.prototype["delete"] = function(e) {
      this.splice(e, e.oPrev());
      return this.splice(e.sym(), e.sym().oPrev());
    };


    /*
      Swaps the diagonal of a quad
     */

    PointSet.prototype.swap = function(e) {
      var a, b;
      a = e.oPrev();
      b = e.sym().oPrev;
      this.splice(e, a);
      this.splice(e.sym(), b);
      this.splice(e, a.lNext());
      this.splice(e.sym(), b.lNext());
      e.org(a.dest());
      return e.dest(b.dest());
    };


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
      this.pts.push(point);
      this.triangulate();
      return point;
    };


    /*
      Performs the Delaunay triangulation
     */

    PointSet.prototype.triangulate = function() {
      var arr, ccw, compare, cont, delaunay, dfs, formed, i, inCircle, leftOf, point, rightOf, start, swap, visited, _i, _j, _len, _ref, _ref1, _ref2, _results;
      compare = (function(_this) {
        return function(i, j) {
          var d;
          d = _this.pts[i].x - _this.pts[j].x;
          if (d !== 0) {
            return d;
          } else {
            return _this.pts[i].y - _this.pts[j].y;
          }
        };
      })(this);
      swap = (function(_this) {
        return function(i, j) {
          var tmp;
          tmp = pts[i];
          pts[i] = pts[j];
          return pts[j] = tmp;
        };
      })(this);
      ccw = (function(_this) {
        return function(a, b, c) {
          return (_this.pts[b].x - _this.pts[a].x) * (_this.pts[c].y - _this.pts[a].y) - (_this.pts[c].x - _this.pts[a].x) * (_this.pts[b].y - _this.pts[a].y) > 0;
        };
      })(this);
      rightOf = (function(_this) {
        return function(i, e) {
          return ccw(i, e.dest(), e.org());
        };
      })(this);
      leftOf = (function(_this) {
        return function(i, e) {
          return ccw(i, e.org(), e.dest());
        };
      })(this);
      inCircle = (function(_this) {
        return function(a, b, c, d) {
          var a20, a21, a22, a23, b0, b1, b10, b11, b2, b3, b4, b5, b6, b7, b8, b9;
          a20 = _this.pts[a].x * _this.pts[a].x + _this.pts[a].y * _this.pts[a].y;
          a21 = _this.pts[b].x * _this.pts[b].x + _this.pts[b].y * _this.pts[b].y;
          a22 = _this.pts[c].x * _this.pts[c].x + _this.pts[c].y * _this.pts[c].y;
          a23 = _this.pts[d].x * _this.pts[d].x + _this.pts[d].y * _this.pts[d].y;
          b0 = _this.pts[a].x * _this.pts[b].y - _this.pts[b].x * _this.pts[a].y;
          b1 = _this.pts[a].x * _this.pts[c].y - _this.pts[c].x * _this.pts[a].y;
          b2 = _this.pts[a].x * _this.pts[d].y - _this.pts[d].x * _this.pts[a].y;
          b3 = _this.pts[b].x * _this.pts[c].y - _this.pts[c].x * _this.pts[b].y;
          b4 = _this.pts[b].x * _this.pts[d].y - _this.pts[d].x * _this.pts[b].y;
          b5 = _this.pts[c].x * _this.pts[d].y - _this.pts[d].x * _this.pts[c].y;
          b6 = a20 - a21;
          b7 = a20 - a22;
          b8 = a20 - a23;
          b9 = a21 - a22;
          b10 = a21 - a23;
          b11 = a22 - a23;
          return (b0 * b11 - b1 * b10 + b2 * b9 + b3 * b8 - b4 * b7 + b5 * b6) > 0;
        };
      })(this);
      delaunay = (function(_this) {
        return function(arr) {
          var a, b, c, l, ldi, ldo, r, rdi, rdo, t, vl, vr, _ref, _ref1;
          switch (arr.length) {
            case 0:
            case 1:
              return [];
            case 2:
              a = _this.makeEdge();
              a.org(arr[0]);
              a.dest(arr[1]);
              return [a, a.sym()];
            case 3:
              a = _this.makeEdge();
              a.org(arr[0]);
              a.dest(arr[1]);
              b = _this.makeEdge();
              b.org(arr[1]);
              b.dest(arr[2]);
              _this.splice(a.sym(), b);
              if (ccw(arr[0], arr[1], arr[2])) {
                c = _this.connect(b, a);
                return [a, b.sym()];
              } else if (ccw(arr[0], arr[2], arr[1])) {
                c = _this.connect(b, a);
                return [c.sym(), c];
              } else {
                return [a, b.sym()];
              }
              break;
            default:
              _ref = delaunay(arr.slice(0, arr.length >> 1)), ldo = _ref[0], ldi = _ref[1];
              _ref1 = delaunay(arr.slice(arr.length >> 1)), rdi = _ref1[0], rdo = _ref1[1];
              while (true) {
                if (leftOf(rdi.org(), ldi)) {
                  ldi = ldi.lNext();
                } else if (rightOf(ldi.org(), rdi)) {
                  rdi = rdi.rPrev();
                } else {
                  break;
                }
              }
              b = _this.connect(rdi.sym(), ldi);
              if (ldi.org() === ldo.org()) {
                ldo = b.sym();
              }
              if (rdi.org() === rdo.org()) {
                rdo = b;
              }
              while (true) {
                l = b.sym().oNext();
                if (rightOf(l.dest(), b)) {
                  while (inCircle(b.dest(), b.org(), l.dest(), l.oNext().dest())) {
                    t = l.oNext();
                    _this["delete"](l);
                    l = t;
                  }
                }
                r = b.oPrev();
                if (rightOf(r.dest(), b)) {
                  while (inCircle(b.dest(), b.org(), r.dest(), r.oPrev().dest())) {
                    t = r.oPrev();
                    _this["delete"](r);
                    r = t;
                  }
                }
                vl = rightOf(l.dest(), b);
                vr = rightOf(r.dest(), b);
                if (!vl && !vr) {
                  break;
                }
                if (!vl || (vr && inCircle(l.dest(), l.org(), r.org(), r.dest()))) {
                  b = _this.connect(r, b.sym());
                } else {
                  b = _this.connect(b.sym(), l.sym());
                }
              }
              return [ldo, rdo];
          }
        };
      })(this);
      this.lines = [];
      this.trgs = [];
      visited = {};
      formed = {};
      cont = (function(_this) {
        return function(edge) {
          dfs(edge.lNext());
          dfs(edge.rNext());
          dfs(edge.oNext());
          return dfs(edge.dNext());
        };
      })(this);
      dfs = (function(_this) {
        return function(edge) {
          var a, b, c, key, x, y, z, _ref;
          if (visited[edge.id]) {
            return;
          }
          visited[edge.id] = true;
          if ((a = edge.org()) < (b = edge.dest())) {
            _this.lines.push(edge.org());
            _this.lines.push(edge.dest());
            c = edge.lNext().dest();
            _ref = [a, b, c].sort(function(x, y) {
              return x - y;
            }), x = _ref[0], y = _ref[1], z = _ref[2];
            key = x * _this.pts.length * _this.pts.length + y * _this.pts.length + z;
            if (!formed[key] && ccw(a, b, c)) {
              formed[key] = true;
              _this.trgs.push(a);
              _this.trgs.push(b);
              _this.trgs.push(c);
            }
          }
          return cont(edge);
        };
      })(this);
      if ((start = (delaunay((function() {
        _results = [];
        for (var _i = 0, _ref = this.pts.length - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; 0 <= _ref ? _i++ : _i--){ _results.push(_i); }
        return _results;
      }).apply(this).sort(compare)))[0])) {
        dfs(start);
      }
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.idxLines);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.lines), this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.idxTrgs);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.trgs), this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
      arr = new Float32Array(this.pts.length * 4);
      _ref1 = this.pts;
      for (i = _j = 0, _len = _ref1.length; _j < _len; i = ++_j) {
        point = _ref1[i];
        arr[(i << 2) + 0] = point.x;
        arr[(i << 2) + 1] = point.y;
        arr[(i << 2) + 2] = point.i;
        arr[(i << 2) + 3] = (_ref2 = point.selected) != null ? _ref2 : {
          1.0: 0.0
        };
      }
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.data);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, arr, this.gl.STATIC_DRAW);
      return this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    };


    /*
      Returns the number of points in the set
     */

    PointSet.prototype.getPointCount = function() {
      return this.pts.length;
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
          _ref = _this.set.pts;
          for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
            point = _ref[_j];
            point.selected = false;
          }
          _ref1 = _this.set.pts;
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
          }
          _this.set.triangulate();
          _this.parent.bind('mousemove', function(e) {
            sel.x = e.pageX;
            sel.y = e.pageY;
            return _this.set.triangulate();
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
      this.shLines.use();
      this.shLines.uniform("u_proj", proj);
      this.shLines.uniform("u_view", view);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.set.data);
      this.gl.vertexAttribPointer(0, 4, this.gl.FLOAT, false, 16, 0);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.set.idxLines);
      this.gl.drawElements(this.gl.LINES, this.set.getLineCount(), this.gl.UNSIGNED_SHORT, 0);
      this.shPoints.use();
      this.shPoints.uniform("u_proj", proj);
      this.shPoints.uniform("u_view", view);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.set.data);
      this.gl.vertexAttribPointer(0, 4, this.gl.FLOAT, false, 16, 0);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
      this.gl.drawArrays(this.gl.POINTS, 0, this.set.getPointCount());
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
