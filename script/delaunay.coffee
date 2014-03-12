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
  ###
    Creates a new set which will manage the points of interest
    @param {WebGLRenderingContext} gl
  ###
  constructor: (@gl) ->
    @points = []
    @lines = []
    @trgs = []

    @data = @gl.createBuffer()
    @idxLines = @gl.createBuffer()
    @idxTrgs = @gl.createBuffer()

  ###
    Adds a new point to the existing set
  ###
  addPoint: (x, y) ->
    point =
      x: x
      y: y
      i: Math.random()
      selected: true

    @points.push(point)
    @triangulate()
    @genBuffer()
    return point

  ###
    Uploads the update buffers & indices
  ###
  genBuffer: ->
    arr = new Float32Array(@points.length * 4)
    for point, i in @points
      arr[(i << 2) + 0] = point.x
      arr[(i << 2) + 1] = point.y
      arr[(i << 2) + 2] = point.i
      arr[(i << 2) + 3] = point.selected ? 1.0 : 0.0

    @gl.bindBuffer @gl.ARRAY_BUFFER, @data
    @gl.bufferData @gl.ARRAY_BUFFER, arr, @gl.STATIC_DRAW
    @gl.bindBuffer @gl.ARRAY_BUFFER, null

  ###
    Performs the Delaunay triangulation
  ###
  triangulate: ->

    divide = (pts) =>
      switch pts.length
        when 0 then return []
        when 1 then return [pts]
        when 2
          @lines.push(pts[0])
          @lines.push(pts[1])
          return [pts]
        when 3
          @lines.push(pts[0])
          @lines.push(pts[1])
          @lines.push(pts[1])
          @lines.push(pts[2])
          @lines.push(pts[2])
          @lines.push(pts[0])
          @trgs.push(pts[0])
          @trgs.push(pts[1])
          @trgs.push(pts[2])
          return [pts]
        else
          left = divide pts.slice(0, (pts.length >> 1) + 1)
          right = divide pts.slice((pts.length >> 1) + 1, pts.length)

          left.push x for x in right
          return left

    @lines = []
    @trgs = []
    divide [0..@points.length - 1].sort (i, j) =>
      d = @points[i].x - @points[j].x
      if d != 0
        return d
      else
        return @points[i].y - @points[j].y

    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, @idxLines
    @gl.bufferData @gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(@lines), @gl.STATIC_DRAW
    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, null

    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, @idxTrgs
    @gl.bufferData @gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(@trgs), @gl.STATIC_DRAW
    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, null

  ###
    Returns the number of points in the set
  ###
  getPointCount: ->
    @points.length

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
      for point in @set.points
        point.selected = false

      for point in @set.points
        if Math.abs(e.pageX - point.x) <= 5 and Math.abs(e.pageY - point.y) <= 5
          point.selected = true
          sel = point
          break

      unless sel
        sel = @set.addPoint e.pageX, e.pageY
        @set.genBuffer()

      @set.genBuffer()
      @parent.bind 'mousemove', (e) =>
        sel.x = e.pageX
        sel.y = e.pageY
        @set.genBuffer()
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

    # Draw the points
    @shPoints.use()
    @shPoints.uniform "u_proj", proj
    @shPoints.uniform "u_view", view
    @gl.bindBuffer @gl.ARRAY_BUFFER, @set.data
    @gl.vertexAttribPointer 0, 4, @gl.FLOAT, false, 16, 0
    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, null
    @gl.drawArrays @gl.POINTS, 0, @set.getPointCount()

    # Draw the lines
    @shLines.use()
    @shLines.uniform "u_proj", proj
    @shLines.uniform "u_view", view
    @gl.bindBuffer @gl.ARRAY_BUFFER, @set.data
    @gl.vertexAttribPointer 0, 4, @gl.FLOAT, false, 16, 0
    @gl.bindBuffer @gl.ELEMENT_ARRAY_BUFFER, @set.idxLines
    @gl.drawElements @gl.LINES, @set.getLineCount(), @gl.UNSIGNED_SHORT, 0

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

    @gl.disableVertexAttribArray 0

  loop: ->
    @render()
    window.requestAnimationFrame =>
      @loop()

$ ->
  new Delaunay()
