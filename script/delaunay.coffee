### ----------------------------------------------------------------------------
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
---------------------------------------------------------------------------- ###

###
  OpenGL shader object wrapper
###
class Shader
  ###
    Creates a new shader, retrieving source code from script tags
    that have the same class name as the name of this shader
    @param {WebGLRenderingContext} gl OpenGL context
    @param {String} name              Name of the shader
    @throws If a source file is invalid, compilation fails or linking fails
  ###
  constructor: (@gl, @name) ->
    @prog = @gl.createProgram()
    @unifs = {}
    @attribs = {}

    $("script." + @name).each (idx, src) =>
      type = $(src).attr("type")
      switch type
        when "x-shader/x-fragment"
          @compile(src.text, @gl.FRAGMENT_SHADER)
        when "x-shader/x-vertex"
          @compile(src.text, @gl.VERTEX_SHADER)
        else
          throw new Error("Invalid shader type '" + type + "'")

    @link()

  ###
    Compiles a single shader source file
    @param {String} src  Source code
    @param {Number} type Type of shader
    @throws If compilation fails
  ###
  compile: (src, type) ->
    sh = @gl.createShader type
    @gl.shaderSource sh, src
    @gl.compileShader sh

    unless @gl.getShaderParameter sh, @gl.COMPILE_STATUS
      throw new Error(@gl.getShaderInfoLog(sh))

    @gl.attachShader @prog, sh

  ###
    Links a shader program
    @throw If linking fails
  ###
  link: ->
    @gl.bindAttribLocation @prog, 0, "in_vertex"
    @gl.bindAttribLocation @prog, 1, "in_color"
    @gl.bindAttribLocation @prog, 2, "in_normal"
    @gl.bindAttribLocation @prog, 3, "in_uv"

    @gl.linkProgram @prog
    unless @gl.getProgramParameter @prog, @gl.LINK_STATUS
      throw new Error(@gl.getProgramInfoLog(@prog))

    count = @gl.getProgramParameter @prog, @gl.ACTIVE_UNIFORMS
    for i in [0..count - 1]
      unif =  @gl.getActiveUniform @prog, i
      @unifs[unif.name] =
        loc: @gl.getUniformLocation @prog, unif.name
        type: unif.type

    count = @gl.getProgramParameter @prog, @gl.ACTIVE_ATTRIBUTES
    for i in [0..count - 1]
      attrib = @gl.getActiveAttrib @prog, i
      @attribs[attrib.name] = @gl.getActiveAttrib @prog, attrib.name

  ###
    Binds the program to the context
  ###
  use: ->
    @gl.useProgram @prog

  ###
    Sets the value of a uniform parameter
    @param {String} name  Name of the uniform
    @param {Object} value Actual value
  ###
  uniform: (name, value) ->
    unless name of @unifs
      return

    switch @unifs[name].type
      when @gl.FLOAT_MAT4
        unless value instanceof Float32Array and value.length == 16
          throw new Error("Invalid uniform value, expected mat4")
        @gl.uniformMatrix4fv @unifs[name].loc, false, value
      when @gl.INT
        unless value instanceof Number and value % 1 == 0
          throw new Error("Invalid uniform value, expected integer")
        @gl.uniform1i @unifs[name].loc, value
      when @gl.FLOAT
        unless value instanceof NUmber
          throw new Error("Invalid uniform value, expected float")
        @gl.uniform1f @unifs[name].loc, value

class PointSet
  self = {}

  class Edge

    ### Creates a new quad edge ###
    constructor: (@set) ->
      @e = [0..3].map (i) =>
        e = new EdgeView(@set)
        e.idx = i
        e.id = self.id++
        e.edge = @
        return e

      @e[0].next = @e[0]
      @e[1].next = @e[3]
      @e[2].next = @e[2]
      @e[3].next = @e[1]

    class EdgeView

      ### Creates a new edge inside the quad edge ###
      constructor: () ->
        @vertex = -1

      ### Rotates the edge CW ###
      rot: -> @edge.e[(@idx + 1) & 3]
      invRot: -> @edge.e[(@idx + 3) & 3]

      ### Returns the symmetric edge ###
      sym: -> @edge.e[(@idx + 2) & 3]

      ### Returns the next edge ###
      oNext: -> @next
      dNext: -> @sym().oNext().sym()
      lNext: -> @invRot().oNext().rot()
      rNext: -> @rot().oNext().invRot()

      ### Returns the previous edge ###
      oPrev: -> @rot().oNext().rot()
      dPrev: -> @invRot().oNext().invRot()
      lPrev: -> @oNext().sym()
      rPrev: -> @sym().oNext()

      ### Returns the endpoints ###
      org: (v) ->
        if v? then @vertex = v
        @vertex

      dest: (v) ->
        @sym().org(v)

      ### Returns the attached faces ###
      left: (f) ->
        if f? then @rot().face = f
        @rot().face

      right: (f) ->
        if f? then @invRot().face = f
        @invRot().face

  ###
    Creates a new set which will manage the points of interest
    @param {WebGLRenderingContext} gl
  ###
  constructor: (@gl) ->
    self = @
    @pts = []
    @lines = []
    @trgs = []
    @id = 0

    @data = @gl.createBuffer()
    @idxLines = @gl.createBuffer()
    @idxTrgs = @gl.createBuffer()

  ###
    Creates a new edge
    @return {EdgeView}
  ###
  makeEdge: () ->
    (new Edge()).e[0]

  ###
    Splices two edges
  ###
  splice: (a, b) ->
    alpha = a.oNext().rot()
    beta = b.oNext().rot()

    an = a.oNext()
    bn = b.oNext()
    alphan = alpha.oNext()
    betan = beta.oNext()

    a.next = bn
    b.next = an
    alpha.next = betan
    beta.next = alphan

  ###
    Creates a new edge connecting the endpoints of
    an existing edge
  ###
  connect: (a, b, side) ->
    e = @makeEdge()
    e.org(a.dest())
    e.dest(b.org())

    @splice(e, a.lNext())
    @splice(e.sym(), b)

    return e

  ###
    Removes an edge
  ###
  delete: (e) ->
    @splice(e, e.oPrev())
    @splice(e.sym(), e.sym().oPrev())

  ###
    Swaps the diagonal of a quad
  ###
  swap: (e) ->
    a = e.oPrev()
    b = e.sym().oPrev

    @splice(e, a)
    @splice(e.sym(), b)
    @splice(e, a.lNext())
    @splice(e.sym(), b.lNext())

    e.org(a.dest())
    e.dest(b.dest())

  ###
    Adds a new point to the existing set
  ###
  addPoint: (x, y) ->
    point =
      x: x
      y: y
      i: Math.random()
      selected: true

    @pts.push(point)
    @triangulate()
    return point

  ###
    Performs the Delaunay triangulation
  ###
  triangulate: ->
    # Lexicographical order of points
    compare = (i, j) =>
      d = @pts[i].x - @pts[j].x
      return if d != 0 then d else @pts[i].y - @pts[j].y

    # Swaps two elements in an array
    swap = (i, j) =>
      tmp = pts[i]
      pts[i] = pts[j]
      pts[j] = tmp

    # Checks the winding of 3 points
    ccw = (a, b, c) =>
      (@pts[b].x - @pts[a].x) * (@pts[c].y - @pts[a].y) -
      (@pts[c].x - @pts[a].x) * (@pts[b].y - @pts[a].y) > 0

    # Checks if a point is left of an edge
    rightOf = (i, e) =>
      ccw i, e.dest(), e.org()

    # Checks if a point is right of an edge
    leftOf = (i, e) =>
      ccw i, e.org(), e.dest()

    # Checkf if the points are inside a circle
    inCircle = (a, b, c, d) =>
      a20 = @pts[a].x * @pts[a].x + @pts[a].y * @pts[a].y;
      a21 = @pts[b].x * @pts[b].x + @pts[b].y * @pts[b].y;
      a22 = @pts[c].x * @pts[c].x + @pts[c].y * @pts[c].y;
      a23 = @pts[d].x * @pts[d].x + @pts[d].y * @pts[d].y;

      b0  = @pts[a].x * @pts[b].y - @pts[b].x * @pts[a].y
      b1  = @pts[a].x * @pts[c].y - @pts[c].x * @pts[a].y
      b2  = @pts[a].x * @pts[d].y - @pts[d].x * @pts[a].y
      b3  = @pts[b].x * @pts[c].y - @pts[c].x * @pts[b].y
      b4  = @pts[b].x * @pts[d].y - @pts[d].x * @pts[b].y
      b5  = @pts[c].x * @pts[d].y - @pts[d].x * @pts[c].y
      b6  = a20 - a21
      b7  = a20 - a22
      b8  = a20 - a23
      b9  = a21 - a22
      b10 = a21 - a23
      b11 = a22 - a23

      (b0 * b11 - b1 * b10 + b2 * b9 + b3 * b8 - b4 * b7 + b5 * b6) > 0

    # Delaunay + quicksort
    delaunay = (arr) =>
      switch arr.length
        when 0, 1 then return []
        when 2
          a = @makeEdge()
          a.org(arr[0])
          a.dest(arr[1])
          return [a, a.sym()]
        when 3
          a = @makeEdge()
          a.org(arr[0])
          a.dest(arr[1])

          b = @makeEdge()
          b.org(arr[1])
          b.dest(arr[2])

          @splice(a.sym(), b)

          if ccw arr[0], arr[1], arr[2]
            c = @connect(b, a)
            return [a, b.sym()]
          else if ccw arr[0], arr[2], arr[1]
            c = @connect(b, a)
            return [c.sym(), c]
          else
            return [a, b.sym()]
        else
          [ldo, ldi] = delaunay arr.slice(0, (arr.length >> 1))
          [rdi, rdo] = delaunay arr.slice(arr.length >> 1)

          loop
            if leftOf rdi.org(), ldi
              ldi = ldi.lNext()
            else if rightOf ldi.org(), rdi
              rdi = rdi.rPrev()
            else
              break

          b = @connect rdi.sym(), ldi

          if ldi.org() == ldo.org() then ldo = b.sym()
          if rdi.org() == rdo.org() then rdo = b

          loop
            l = b.sym().oNext()
            if rightOf l.dest(), b
              while inCircle b.dest(), b.org(), l.dest(), l.oNext().dest()
                t = l.oNext()
                @delete(l)
                l = t

            r = b.oPrev()
            if rightOf r.dest(), b
              while inCircle b.dest(), b.org(), r.dest(), r.oPrev().dest()
                t = r.oPrev()
                @delete(r)
                r = t

            vl = rightOf l.dest(), b
            vr = rightOf r.dest(), b
            if not vl and not vr
              break

            if not vl or (vr and inCircle l.dest(), l.org(), r.org(), r.dest())
              b = @connect r, b.sym()
            else
              b = @connect b.sym(), l.sym()

          return [ldo, rdo]

    @lines = []
    @trgs = []

    visited = {}
    formed = {}

    cont = (edge) =>
      dfs edge.lNext()
      dfs edge.rNext()
      dfs edge.oNext()
      dfs edge.dNext()

    dfs = (edge) =>
      if visited[edge.id]
        return

      visited[edge.id] = true

      if (a = edge.org()) < (b = edge.dest())
        @lines.push edge.org()
        @lines.push edge.dest()

        c = edge.lNext().dest()
        [x, y, z] = [a, b, c].sort (x, y) -> x - y
        key = x * @pts.length * @pts.length + y * @pts.length + z
        if not formed[key] and ccw a, b, c
          formed[key] = true
          @trgs.push a
          @trgs.push b
          @trgs.push c

      return cont edge

    if (start = (delaunay [0..@pts.length - 1].sort(compare))[0])
      dfs start

    console.log @trgs.length, @lines.length

    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, @idxLines
    @gl.bufferData @gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(@lines), @gl.STATIC_DRAW
    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, null

    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, @idxTrgs
    @gl.bufferData @gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(@trgs), @gl.STATIC_DRAW
    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, null

    arr = new Float32Array(@pts.length * 4)
    for point, i in @pts
      arr[(i << 2) + 0] = point.x
      arr[(i << 2) + 1] = point.y
      arr[(i << 2) + 2] = point.i
      arr[(i << 2) + 3] = point.selected ? 1.0 : 0.0

    @gl.bindBuffer @gl.ARRAY_BUFFER, @data
    @gl.bufferData @gl.ARRAY_BUFFER, arr, @gl.STATIC_DRAW
    @gl.bindBuffer @gl.ARRAY_BUFFER, null

  ###
    Returns the number of points in the set
  ###
  getPointCount: ->
    @pts.length

  ###
    Returns the number of triangles
  ###
  getTriangleCount: ->
    @trgs.length

  ###
    Returns the number of lines joining the points
  ###
  getLineCount: ->
    @lines.length


class Delaunay
  constructor: ->
    # Create a webgl context
    @parent = $("#canvas")
    @canvas = $("canvas", @parent).get(0)

    glNames = [ "webgl", "experimental-webgl" ]
    for i in glNames
      try
        @gl = @canvas.getContext(i)
      catch err
        continue

      unless @gl
        break

    unless @gl
      throw new Error("Cannot create WebGL context")

    # Setup GL
    @shTrgs = new Shader(@gl, "trgs")
    @shPoints = new Shader(@gl, "points")
    @shLines  = new Shader(@gl, "lines")
    @set = new PointSet(@gl)

    gradient = new Uint8Array([
       0,    0, 127, 255,
       0,    0, 255, 255,
       0,   63, 255, 255,
       0,  127, 255, 255,
       0,  191, 255, 255,
       0,  255, 255, 255,
       63, 255, 191, 255,
      127, 255, 127, 255,
      191, 255,  63, 255,
      255, 255,   0, 255,
      255, 191,   0, 255,
      255, 127,   0, 255,
      255,  63,   0, 255,
      255,   0,   0, 255,
      191,   0,   0, 255,
      127,   0,   0, 255
    ])

    @gradient = @gl.createTexture()
    @gl.bindTexture @gl.TEXTURE_2D, @gradient
    @gl.texParameteri @gl.TEXTURE_2D, @gl.TEXTURE_MAG_FILTER, @gl.LINEAR
    @gl.texParameteri @gl.TEXTURE_2D, @gl.TEXTURE_MIN_FILTER, @gl.LINEAR
    @gl.texParameteri @gl.TEXTURE_2D, @gl.TEXTURE_WRAP_S, @gl.CLAMP_TO_EDGE
    @gl.texParameteri @gl.TEXTURE_2D, @gl.TEXTURE_WRAP_T, @gl.CLAMP_TO_EDGE
    @gl.texImage2D @gl.TEXTURE_2D, 0, @gl.RGBA, 16, 1, 0, @gl.RGBA,
                   @gl.UNSIGNED_BYTE, gradient
    @gl.bindTexture @gl.TEXTURE_2D, null

    # Clicking adds a new point or selects an old one
    @parent.bind 'mousedown', (e) =>
      sel = null
      for point in @set.pts
        point.selected = false

      for point in @set.pts
        if Math.abs(e.pageX - point.x) <= 5 and Math.abs(e.pageY - point.y) <= 5
          point.selected = true
          sel = point
          break

      unless sel
        sel = @set.addPoint e.pageX, e.pageY

      @set.triangulate()
      @parent.bind 'mousemove', (e) =>
        sel.x = e.pageX
        sel.y = e.pageY
        @set.triangulate()
      @parent.bind 'mouseup', (e) =>
        @parent.unbind 'mousemove mouseup'

      e.preventDefault()

    # Start rendering
    @loop()

  render: ->
    w = @canvas.width = @parent.width()
    h = @canvas.height = @parent.height()
    @gl.viewport(0, 0, w, h)
    @gl.clear(@gl.COLOR_BUFFER_BIT)

    proj = mat4.ortho mat4.create(), 0, w, h, 0, -1, 1
    view = mat4.identity mat4.create()

    @gl.enableVertexAttribArray 0

    # Draw the triangles
    @shTrgs.use()
    @shTrgs.uniform "u_proj", proj
    @shTrgs.uniform "u_view", view
    @shTrgs.uniform "u_gradient", 0
    @gl.activeTexture @gl.TEXTURE0
    @gl.bindTexture @gl.TEXTURE_2D, @gradient
    @gl.bindBuffer @gl.ARRAY_BUFFER, @set.data
    @gl.vertexAttribPointer 0, 4, @gl.FLOAT, false, 16, 0
    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, @set.idxTrgs
    @gl.drawElements @gl.TRIANGLES, @set.getTriangleCount(), @gl.UNSIGNED_SHORT, 0

    # Draw the lines
    @shLines.use()
    @shLines.uniform "u_proj", proj
    @shLines.uniform "u_view", view
    @gl.bindBuffer @gl.ARRAY_BUFFER, @set.data
    @gl.vertexAttribPointer 0, 4, @gl.FLOAT, false, 16, 0
    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, @set.idxLines
    @gl.drawElements @gl.LINES, @set.getLineCount(), @gl.UNSIGNED_SHORT, 0

    # Draw the points
    @shPoints.use()
    @shPoints.uniform "u_proj", proj
    @shPoints.uniform "u_view", view
    @gl.bindBuffer @gl.ARRAY_BUFFER, @set.data
    @gl.vertexAttribPointer 0, 4, @gl.FLOAT, false, 16, 0
    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, null
    @gl.drawArrays @gl.POINTS, 0, @set.getPointCount()

    @gl.disableVertexAttribArray 0

  loop: ->
    @render()
    window.requestAnimationFrame =>
      @loop()

$ ->
  new Delaunay()
