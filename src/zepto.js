//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

var Zepto = (function() {
  var undefined, key, $, classList, emptyArray = [], concat = emptyArray.concat, filter = emptyArray.filter, slice = emptyArray.slice,
    document = window.document,
    elementDisplay = {}, classCache = {},
    // css中值为数字的属性（竟然只有这么几个）
    cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
    fragmentRE = /^\s*<(\w+|!)[^>]*>/,
    singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
    tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    rootNodeRE = /^(?:body|html)$/i,
    capitalRE = /([A-Z])/g,

    // special attributes that should be get/set via method calls
    methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

    adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
    table = document.createElement('table'),
    tableRow = document.createElement('tr'),
    containers = {
      'tr': document.createElement('tbody'),
      'tbody': table, 'thead': table, 'tfoot': table,
      'td': tableRow, 'th': tableRow,
      '*': document.createElement('div')
    },
    readyRE = /complete|loaded|interactive/,
    simpleSelectorRE = /^[\w-]*$/,
    class2type = {},
    toString = class2type.toString,
    zepto = {},
    camelize, uniq,
    tempParent = document.createElement('div'),
    propMap = {
      'tabindex': 'tabIndex',
      'readonly': 'readOnly',
      'for': 'htmlFor',
      'class': 'className',
      'maxlength': 'maxLength',
      'cellspacing': 'cellSpacing',
      'cellpadding': 'cellPadding',
      'rowspan': 'rowSpan',
      'colspan': 'colSpan',
      'usemap': 'useMap',
      'frameborder': 'frameBorder',
      'contenteditable': 'contentEditable'
    },
    // Array.isArray ECMA5.1标准方法
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
    // 如果不存在，就新定义一个
    isArray = Array.isArray ||
      function(object){ return object instanceof Array }

  // 元素是否匹配选择器
  zepto.matches = function(element, selector) {
    if (!selector || !element || element.nodeType !== 1) return false
    // DOM API: Element.matches() 兼容性不好，浏览器各自实现带有前缀的API
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/matches
    var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
                          element.oMatchesSelector || element.matchesSelector
    if (matchesSelector) return matchesSelector.call(element, selector)
    // fall back to performing a selector:
    // temp针对没有父节点的元素（不在当前文档中？）
    var match, parent = element.parentNode, temp = !parent
    // tempParent = document.createElement('div'),
    if (temp) (parent = tempParent).appendChild(element)
    // ~ 位运算符 按位非（NOT）
    match = ~zepto.qsa(parent, selector).indexOf(element)
    temp && tempParent.removeChild(element)
    return match
  }

  function type(obj) {
    return obj == null ? String(obj) :
      // 常用的模式
      // toString={}.toString
      // toString=Object.prototype.toString
      // class2type是个字典对象，见394行
      class2type[toString.call(obj)] || "object"
  }

  function isFunction(value) { return type(value) == "function" }
  // window.window指向自身，window.window.window.window......也指向自身
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/window
  function isWindow(obj)     { return obj != null && obj == obj.window }
  // 根据nodeType判断是否是document
  // https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
  function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }
  function isObject(obj)     { return type(obj) == "object" }
  // Object.getPrototypeOf() 方法返回指定对象的原型
  // 文档注释：True if the object is a “plain” JavaScript object, which is only true for object literals and objects created with new Object.
  function isPlainObject(obj) {
    return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
  }
  /**
   * 判断是否为类数组，依据为对象是否有数值类型的'length'属性
   */
  function likeArray(obj) { return typeof obj.length == 'number' }
  // filter=[].filter
  // 滤掉是null或undefined的元素
  function compact(array) { return filter.call(array, function(item){ return item != null }) }
  // TODO
  function flatten(array) { return array.length > 0 ? $.fn.concat.apply([], array) : array }
  // /-+(.)?/g匹配一个或多个连续的横线-，和紧跟的字符，如果字符存在，就把字符大写
  // 注意正则中括号里的子规则，子规则匹配的字符可以在函数中接收
  // 作用：'default-option' -> 'defaultOption'
  camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) }
  // 目测效果与camelize相反
  function dasherize(str) {
    return str.replace(/::/g, '/')
            // 这种写法：$1匹配的第一个子串，$2匹配第二个子串，拼接一个下划线
           .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
           .replace(/([a-z\d])([A-Z])/g, '$1_$2')
           .replace(/_/g, '-')
           .toLowerCase()
  }
  // 数组去重
  // 因为indexOf返回第一个匹配的位置，所以对于重复元素array.indexOf(item)和idx不相等
  // 惊为天人了
  uniq = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx }) }
  // 动态创建正则，缓存在classCache
  // 暂时不知道用处
  function classRE(name) {
    return name in classCache ?
      classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
  }
  // value是数字，而属性的值又不能是数字时，加上单位'px'
  // cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
  function maybeAddPx(name, value) {
    return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
  }

  // 获取元素默认display值
  // 这方法不错
  function defaultDisplay(nodeName) {
    var element, display
    // 缓存缓存，先从缓存里取
    if (!elementDisplay[nodeName]) {
      element = document.createElement(nodeName)
      document.body.appendChild(element)
      // window.getComputedStyle返回一个CSSStyleDeclaration对象（css键值对的集合）
      // CSSStyleDeclaration对象提供了获取属性的方法getPropertyValue
      // https://developer.mozilla.org/zh-CN/docs/Web/API/Window/getComputedStyle
      // https://developer.mozilla.org/zh-CN/docs/Web/API/CSSStyleDeclaration
      display = getComputedStyle(element, '').getPropertyValue("display")
      element.parentNode.removeChild(element)
      // 这句不懂。难道有元素默认display值是none？就算是none为啥设置成'block'？
      display == "none" && (display = "block")
      elementDisplay[nodeName] = display
    }
    return elementDisplay[nodeName]
  }

  // 返回子元素
  function children(element) {
    // children返回所有元素节点，但兼容性不好
    return 'children' in element ?
      // slice.call把类数组对象转化成真正的数组
      slice.call(element.children) :
      // nodeType 1 代表元素，要过滤一下，因为childNodes会返回文本节点
      $.map(element.childNodes, function(node){ if (node.nodeType == 1) return node })
  }

  // 构造函数Z
  // 遍历dom元素赋给this
  function Z(dom, selector) {
    var i, len = dom ? dom.length : 0
    for (i = 0; i < len; i++) this[i] = dom[i]
    this.length = len
    this.selector = selector || ''
  }

  // `$.zepto.fragment` takes a html string and an optional tag name
  // to generate DOM nodes from the given html string.
  // The generated DOM nodes are returned as an array.
  // This function can be overridden in plugins for example to make
  // it compatible with browsers that don't support the DOM fully.
  //
  // 还有不少没明白的地方
  zepto.fragment = function(html, name, properties) {
    var dom, nodes, container

    // A special case optimization for a single tag
    // singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/
    // (?:pattern)匹配pattern但不获取匹配结果
    // \num匹配之前匹配的引用
    // 所以这里(?:<\/\1>|)匹配的是闭合标签或什么都没有，比如：<div>, <div></div>, <div />
    // 正则还有很多要学。。
    if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))

    if (!dom) {
      // tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
      // 没看懂，应该是修改闭合标签什么的
      if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
      // fragmentRE = /^\s*<(\w+|!)[^>]*>/,
      if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
      // containers = {
      //   'tr': document.createElement('tbody'),
      //   'tbody': table, 'thead': table, 'tfoot': table,
      //   'td': tableRow, 'th': tableRow,
      //   '*': document.createElement('div')
      // },
      if (!(name in containers)) name = '*'

      container = containers[name]
      // 将html片段放入container
      container.innerHTML = '' + html
      // 返回container的子节点，这里不明白为什么要把子节点都从container中删除
      dom = $.each(slice.call(container.childNodes), function(){
        container.removeChild(this)
      })
    }

    if (isPlainObject(properties)) {
      nodes = $(dom)
      $.each(properties, function(key, value) {
        // methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],
        // 方法属性需要执行一下
        if (methodAttributes.indexOf(key) > -1) nodes[key](value)
        else nodes.attr(key, value)
      })
    }

    return dom
  }

  // `$.zepto.Z` swaps out the prototype of the given `dom` array
  // of nodes with `$.fn` and thus supplying all the Zepto functions
  // to the array. This method can be overriden in plugins.
  //
  // 因为 zepto.Z.prototype = Z.prototype = $.fn
  // 所以 构造函数Z中的this有$.fn的方法
  // 所以返回的实例可以使用$.fn的方法
  zepto.Z = function(dom, selector) {
    return new Z(dom, selector)
  }

  // `$.zepto.isZ` should return `true` if the given object is a Zepto
  // collection. This method can be overridden in plugins.
  zepto.isZ = function(object) {
    return object instanceof zepto.Z
  }

  // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
  // takes a CSS selector and an optional context (and handles various
  // special cases).
  // This method can be overriden in plugins.
  //
  // 非常健壮的接口，应对各种参数
  zepto.init = function(selector, context) {
    var dom
    // If nothing given, return an empty Zepto collection
    if (!selector) return zepto.Z()
    // Optimize for string selectors
    else if (typeof selector == 'string') {
      selector = selector.trim()
      // If it's a html fragment, create nodes from it
      // Note: In both Chrome 21 and Firefox 15, DOM error 12
      // is thrown if the fragment doesn't begin with <
      if (selector[0] == '<' && fragmentRE.test(selector))
        dom = zepto.fragment(selector, RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // If it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
    }
    // If a function is given, call it when the DOM is ready
    //
    // 原来常用的这种写法$(function(){...})出自这里
    else if (isFunction(selector)) return $(document).ready(selector)
    // If a Zepto collection is given, just return it
    else if (zepto.isZ(selector)) return selector
    else {
      // normalize array if an array of nodes is given
      if (isArray(selector)) dom = compact(selector)
      // Wrap DOM nodes.
      else if (isObject(selector))
        dom = [selector], selector = null
      // If it's a html fragment, create nodes from it
      else if (fragmentRE.test(selector))
        dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // And last but no least, if it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
    }
    // create a new Zepto collection from the nodes found
    return zepto.Z(dom, selector)
  }

  // `$` will be the base `Zepto` object. When calling this
  // function just call `$.zepto.init, which makes the implementation
  // details of selecting nodes and creating Zepto collections
  // patchable in plugins.
  $ = function(selector, context){
    return zepto.init(selector, context)
  }

  function extend(target, source, deep) {
    for (key in source)
      // 这个属性是对象或数组
      if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
        // target中不存在这个属性，给一个空的初始值
        if (isPlainObject(source[key]) && !isPlainObject(target[key]))
          target[key] = {}
        if (isArray(source[key]) && !isArray(target[key]))
          target[key] = []

        extend(target[key], source[key], deep)
      }
      // 属性不是对象或数组，就把属性值赋给target[key]
      else if (source[key] !== undefined) target[key] = source[key]
  }

  // Copy all but undefined properties from one or more
  // objects to the `target` object.
  //
  // 对于参数有个小trick，用起来更方便，不错
  $.extend = function(target){
    // args取到第2, 3, 4...个参数
    var deep, args = slice.call(arguments, 1)
    // 如果第一个参数传了true/false进来，那就简单处理一下
    if (typeof target == 'boolean') {
      // 传进来的true/false代表是否深度扩展
      deep = target
      // target目标对象取第2个参数
      target = args.shift()
    }
    args.forEach(function(arg){ extend(target, arg, deep) })
    return target
  }

  // `$.zepto.qsa` is Zepto's CSS selector implementation which
  // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
  // This method can be overriden in plugins.
  //
  // 除id选择，class选择和标签选择外，使用querySelectorAll
  zepto.qsa = function(element, selector){
    var found,
        maybeID = selector[0] == '#',
        maybeClass = !maybeID && selector[0] == '.',
        nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
        // simpleSelectorRE = /^[\w-]*$/,
        isSimple = simpleSelectorRE.test(nameOnly)
    return (element.getElementById && isSimple && maybeID) ? // Safari DocumentFragment doesn't have getElementById
      ( (found = element.getElementById(nameOnly)) ? [found] : [] ) :
      // 1:ELEMENT_NODE, 9:DOCUMENT_NODE, 11:DOCUMENT_FRAGMENT_NODE
      (element.nodeType !== 1 && element.nodeType !== 9 && element.nodeType !== 11) ? [] :
      slice.call(
        isSimple && !maybeID && element.getElementsByClassName ? // DocumentFragment doesn't have getElementsByClassName/TagName
          maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
          element.getElementsByTagName(selector) : // Or a tag
          element.querySelectorAll(selector) // Or it's not simple, and we need to query all
      )
  }

  // 根据选择器过滤节点
  function filtered(nodes, selector) {
    return selector == null ? $(nodes) : $(nodes).filter(selector)
  }

  // Node.contains()返回一个布尔值来表示是否传入的节点是，该节点的子节点。
  // 如果 otherNode 是 node 的后代节点或是 node 节点本身.则返回true , 否则返回 false.
  // https://developer.mozilla.org/zh-CN/docs/Web/API/Node/contains
  $.contains = document.documentElement.contains ?
    function(parent, node) {
      return parent !== node && parent.contains(node)
    } :

    /**
     * 如果不支持contains，手动实现一个
     */
    function(parent, node) {
      // node存在，node重新赋值为node的父节点，相当于一层一层遍历父节点，直到没有父节点为止
      while (node && (node = node.parentNode))
        if (node === parent) return true
      return false
    }
  /**
   * 不明觉厉
   * TODO
   */
  function funcArg(context, arg, idx, payload) {
    return isFunction(arg) ? arg.call(context, idx, payload) : arg
  }
  /**
   * 给元素设置属性，如果value为null，移除属性
   * @param node 元素
   * @param name 属性名
   * @param value 属性值
   */
  function setAttribute(node, name, value) {
    // Element.removeAttribute()移除一个属性
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Element/removeAttribute
    // Element.setAttribute()设置一个属性
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Element/setAttribute
    value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
  }

  /**
   * 不明觉厉
   * TODO
   */
  // access className property while respecting SVGAnimatedString
  function className(node, value){
    var klass = node.className || '',
        svg   = klass && klass.baseVal !== undefined

    if (value === undefined) return svg ? klass.baseVal : klass
    svg ? (klass.baseVal = value) : (node.className = value)
  }

  /**
   * 反序列化字符串
   * 
   * @param value 要反序列化的字符串
   *
   * @return
   * "true"  => true
   * "false" => false
   * "null"  => null
   * "42"    => 42
   * "42.5"  => 42.5
   * "08"    => "08"
   * JSON    => parse if valid
   * String  => self
   */

  function deserializeValue(value) {
    try {
      return value ?
        value == "true" ||
        ( value == "false" ? false :
          value == "null" ? null :
          // 先把value转成数值，再转成字符串，如果结果和原value相等，就把value转成数字
          // 应对"08"这种情况
          +value + "" == value ? +value :
          // 如果value以\[\{开头，尝试转成JSON对象
          /^[\[\{]/.test(value) ? $.parseJSON(value) :
          value )
        : value
    } catch(e) {
      return value
    }
  }

  $.type = type
  $.isFunction = isFunction
  $.isWindow = isWindow
  $.isArray = isArray
  $.isPlainObject = isPlainObject

  /**
   *判断是否为空对象
   */
  $.isEmptyObject = function(obj) {
    var name
    for (name in obj) return false
    return true
  }

  /**
   * 判断元素是否在数组中
   *
   * @param elem 元素
   * @param array 数组
   * @param i fromIndex
   *
   * @return 和indexOf类似
   */
  $.inArray = function(elem, array, i){
    return emptyArray.indexOf.call(array, elem, i)
  }

  $.camelCase = camelize
  /**
   * 去空格
   * @param str 需要去空格的字符串
   * @return 去掉空格后新字符串
   */
  $.trim = function(str) {
    return str == null ? "" : String.prototype.trim.call(str)
  }

  // plugin compatibility
  $.uuid = 0
  $.support = { }
  $.expr = { }
  $.noop = function() {}

  /**
   * 根据规则生成新的数组
   * @param elements 原 数组或类数组
   * @param callback 处理规则
   *
   * @return 新数组 
   */
  $.map = function(elements, callback){
    var value, values = [], i, key
    if (likeArray(elements))
      for (i = 0; i < elements.length; i++) {
        value = callback(elements[i], i)
        if (value != null) values.push(value)
      }
    else
      for (key in elements) {
        value = callback(elements[key], key)
        if (value != null) values.push(value)
      }
    return flatten(values)
  }

  /**
   * 遍历数组
   * @param elements 原 数组或类数组
   * @param callback 处理规则
   *
   * @return 新数组
   *
   * Q: 为什么$.map中的callback接收的参数先是元素，再是索引，
   * 而$.each中的callback接收的参数先是索引，再是元素？
   */
  $.each = function(elements, callback){
    var i, key
    if (likeArray(elements)) {
      for (i = 0; i < elements.length; i++)
        // 当前元素作为上下文
        if (callback.call(elements[i], i, elements[i]) === false) return elements
    } else {
      for (key in elements)
        if (callback.call(elements[key], key, elements[key]) === false) return elements
    }

    return elements
  }

  /**
   * 根据规则过滤元素
   */
  $.grep = function(elements, callback){
    return filter.call(elements, callback)
  }

  if (window.JSON) $.parseJSON = JSON.parse

  // Populate the class2type map
  $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
    class2type[ "[object " + name + "]" ] = name.toLowerCase()
  })

  // Define methods that will be available on all
  // Zepto collections
  $.fn = {
    constructor: zepto.Z,
    length: 0,

    // Because a collection acts like an array
    // copy over these useful array functions.
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    push: emptyArray.push,
    sort: emptyArray.sort,
    // splice 删除数组存在的元素，并添加指定的元素
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
    splice: emptyArray.splice,
    indexOf: emptyArray.indexOf,
    /**
     * 给数组增加元素
     *
     * @param 可以传很多个Zepto对象或数组（内部arguments接收）
     *
     * @return 新数组
     */
    concat: function(){
      var i, value, args = []
      // 先把不是数组的参数转换成数组，放到args
      for (i = 0; i < arguments.length; i++) {
        value = arguments[i]
        args[i] = zepto.isZ(value) ? value.toArray() : value
      }
      return concat.apply(zepto.isZ(this) ? this.toArray() : this, args)
    },

    // `map` and `slice` in the jQuery API work differently
    // from their array counterparts
    map: function(fn){
      return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
    },
    slice: function(){
      return $(slice.apply(this, arguments))
    },

    ready: function(callback){
      // need to check if document.body exists for IE as that browser reports
      // document ready when it hasn't yet created the body element
      //
      // readyRE = /complete|loaded|interactive/,
      // 如果当前readyState为complete，loaded，interactive，直接执行callback
      if (readyRE.test(document.readyState) && document.body) callback($)
      // 页面文档完全加载并解析完毕之后,会触发DOMContentLoaded事件，HTML文档不会等待样式文件,图片文件,子框架页面的加载
      // https://developer.mozilla.org/zh-CN/docs/Web/Events/DOMContentLoaded
      else document.addEventListener('DOMContentLoaded', function(){ callback($) }, false)
      return this
    },
    /**
     * 获取数组或指定数组元素
     *
     * @param idx 元素索引，可以为负。
     *            如果不传idx，则获取整个数组（注意类数组也会被转成数组）
     *
     * @return Array/DOM node
     */
    get: function(idx){
      // idx >= 0 ? idx : idx + this.length 允许idx为负
      return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
    },
    /**
     * 把类数组对象转换成数组
     */
    toArray: function(){ return this.get() },
    /**
     * 元素个数
     * Q: 为什么要再定义一个size方法？
     */
    size: function(){
      return this.length
    },
    /**
     * 遍历删除所有元素
     */
    remove: function(){
      return this.each(function(){
        if (this.parentNode != null)
          this.parentNode.removeChild(this)
      })
    },
    /**
     * 遍历集合
     *
     * @param callback 回调
     *
     * @return this
     */
    each: function(callback){
      emptyArray.every.call(this, function(el, idx){
        return callback.call(el, idx, el) !== false
      })
      return this
    },
    /**
     * 过滤元素
     *
     * @param selector 可以是function，也可以是选择器
     */
    filter: function(selector){
      if (isFunction(selector)) return this.not(this.not(selector))
      return $(filter.call(this, function(element){
        return zepto.matches(element, selector)
      }))
    },
    /**
     * 添加元素
     *
     * @param selector 选择器
     * @pararm context 上下文，只在此范围内查找
     */
    add: function(selector,context){
      // uniq() 去重
      return $(uniq(this.concat($(selector,context))))
    },
    /**
     * 检测集合第一个元素是否匹配选择器
     */
    is: function(selector){
      return this.length > 0 && zepto.matches(this[0], selector)
    },
    /**
     * 过滤元素
     *
     * @param selector 可以是function，也可以是选择器
     */
    not: function(selector){
      var nodes=[]
      // selector 是函数
      if (isFunction(selector) && selector.call !== undefined)
        this.each(function(idx){
          if (!selector.call(this,idx)) nodes.push(this)
        })
      else {
        // selector 是字符串
        var excludes = typeof selector == 'string' ? this.filter(selector) :
        // selector 是类数组
        // Q: seletor.item 这块没看懂
          (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
        // 遍历当前集合，如果元素不在excludes，推入nodes
        this.forEach(function(el){
          if (excludes.indexOf(el) < 0) nodes.push(el)
        })
      }
      return $(nodes)
    },
    /**
     * 过滤当前集合
     *
     * @param selector 可以是节点，也可以是选择器
     *
     * return 过滤后的新集合
     */
    has: function(selector){
      return this.filter(function(){
        return isObject(selector) ?
          $.contains(this, selector) :
          $(this).find(selector).size()
      })
    },
    /**
     * 根据索引获取元素
     *
     * param idx 索引
     *
     * return Array（虽然只有1个元素，这与get不同）
     */
    eq: function(idx){
      // 索引-1之所以特殊，因为[1,2,3].slice(-1,0)返回[]，参数end为0会出问题
      return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
    },
    /**
     * 获取集合第一个元素
     * 
     * @return 如果元素是对象，就包装成Zepto对象，如果不是，直接返回
     */
    first: function(){
      var el = this[0]
      return el && !isObject(el) ? el : $(el)
    },
    /**
     * 获取集合最后一个元素
     * 
     * @return 同first
     */
    last: function(){
      var el = this[this.length - 1]
      return el && !isObject(el) ? el : $(el)
    },
    /**
     * 查找元素
     * 
     * @param selector 接收各种参数
     *
     * @return Zepto集合
     */
    find: function(selector){
      var result, $this = this
      // 如果selector不存在，或为空字符串，则返回空集合
      if (!selector) result = $()
      // 如果selector是对象（Zepto集合，普通数组，单个对象）
      else if (typeof selector == 'object')
        result = $(selector).filter(function(){
          var node = this
          // some() 方法测试数组中的某些元素是否通过了指定函数的测试。
          // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/some
          // 调用find方法的集合中是否有元素是node的祖先节点
          // 如果有，返回true，通过过滤
          return emptyArray.some.call($this, function(parent){
            return $.contains(parent, node)
          })
        })
      // 走到这里，selector是正常的选择器了，如果当前集合只有1个元素
      else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
      // 集合有多个元素，需要用map遍历
      else result = this.map(function(){ return zepto.qsa(this, selector) })
      return result
    },
    /**
     * 向上遍历（包含自身），选中第一个符合选择器的元素
     *
     * @param selector 选择器
     * @param context 可选，限制选择器的上下文
     *
     * return Zepto对象
     */
    closest: function(selector, context){
      // 只选一个元素
      var node = this[0], collection = false
      // 如果selector是对象，先把对象转成Zepto集合，赋值给collection
      if (typeof selector == 'object') collection = $(selector)
      // collection是false说明selector不是对象，当作选择器来处理
      while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
        // node不等于context，不是document节点时，node被赋值为父节点，继续循环，直到collection包含node或node匹配选择器
        // 如果遍历到context或document节点，node被赋值为false，结束循环
        node = node !== context && !isDocument(node) && node.parentNode
      return $(node)
    },
    /**
     * 获取集合中每个元素的祖先节点
     *
     * @param selector 选择器 可选
     */
    parents: function(selector){
      var ancestors = [], nodes = this
      while (nodes.length > 0)
        nodes = $.map(nodes, function(node){
          if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
            ancestors.push(node)
            return node
          }
        })
      return filtered(ancestors, selector)
    },
    /**
     * 获取集合中每个元素的父节点
     *
     * @param selector 父节点需要符合的选择器
     *
     * @return 父节点集合
     */
    parent: function(selector){
      return filtered(uniq(this.pluck('parentNode')), selector)
    },
    /**
     * 获取集合中每个元素的子节点
     *
     * @param selector 子节点需要符合的选择器
     *
     * @return 子节点集合
     *
     * TODO: 这个实现没有看懂
     */
    children: function(selector){
      return filtered(this.map(function(){ return children(this) }), selector)
    },
    /**
     * 返回集合中每个元素的子节点，包括文本节点和注释节点
     *
     * @return 子节点集合
     */
    contents: function() {
      // contentDocument这个属性不太熟悉，目测是对于iframe元素，会返回document
      return this.map(function() { return this.contentDocument || slice.call(this.childNodes) })
    },
    /**
     * 获取集合中每个元素的兄弟节点
     * 思路：获取父节点的所有子节点，过滤出不是自身的元素
     *
     * @param selector 选择器限制
     */
    siblings: function(selector){
      return filtered(this.map(function(i, el){
        return filter.call(children(el.parentNode), function(child){ return child!==el })
      }), selector)
    },
    /**
     * 清空集合中每个元素的内容
     */
    empty: function(){
      return this.each(function(){ this.innerHTML = '' })
    },
    /**
     * 获取集合中每个元素的指定属性的值
     *
     * @param property 指定属性
     *
     * @return 新的集合
     */
    // `pluck` is borrowed from Prototype.js
    pluck: function(property){
      return $.map(this, function(el){ return el[property] })
    },
    show: function(){
      return this.each(function(){
        this.style.display == "none" && (this.style.display = '')
        if (getComputedStyle(this, '').getPropertyValue("display") == "none")
          this.style.display = defaultDisplay(this.nodeName)
      })
    },
    replaceWith: function(newContent){
      return this.before(newContent).remove()
    },
    wrap: function(structure){
      var func = isFunction(structure)
      if (this[0] && !func)
        var dom   = $(structure).get(0),
            clone = dom.parentNode || this.length > 1

      return this.each(function(index){
        $(this).wrapAll(
          func ? structure.call(this, index) :
            clone ? dom.cloneNode(true) : dom
        )
      })
    },
    wrapAll: function(structure){
      if (this[0]) {
        $(this[0]).before(structure = $(structure))
        var children
        // drill down to the inmost element
        while ((children = structure.children()).length) structure = children.first()
        $(structure).append(this)
      }
      return this
    },
    wrapInner: function(structure){
      var func = isFunction(structure)
      return this.each(function(index){
        var self = $(this), contents = self.contents(),
            dom  = func ? structure.call(this, index) : structure
        contents.length ? contents.wrapAll(dom) : self.append(dom)
      })
    },
    unwrap: function(){
      this.parent().each(function(){
        $(this).replaceWith($(this).children())
      })
      return this
    },
    clone: function(){
      return this.map(function(){ return this.cloneNode(true) })
    },
    hide: function(){
      return this.css("display", "none")
    },
    toggle: function(setting){
      return this.each(function(){
        var el = $(this)
        ;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
      })
    },
    prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
    next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },
    html: function(html){
      return 0 in arguments ?
        this.each(function(idx){
          var originHtml = this.innerHTML
          $(this).empty().append( funcArg(this, html, idx, originHtml) )
        }) :
        (0 in this ? this[0].innerHTML : null)
    },
    text: function(text){
      return 0 in arguments ?
        this.each(function(idx){
          var newText = funcArg(this, text, idx, this.textContent)
          this.textContent = newText == null ? '' : ''+newText
        }) :
        (0 in this ? this.pluck('textContent').join("") : null)
    },
    attr: function(name, value){
      var result
      return (typeof name == 'string' && !(1 in arguments)) ?
        (!this.length || this[0].nodeType !== 1 ? undefined :
          (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
        ) :
        this.each(function(idx){
          if (this.nodeType !== 1) return
          if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
          else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
        })
    },
    removeAttr: function(name){
      return this.each(function(){ this.nodeType === 1 && name.split(' ').forEach(function(attribute){
        setAttribute(this, attribute)
      }, this)})
    },
    prop: function(name, value){
      name = propMap[name] || name
      return (1 in arguments) ?
        this.each(function(idx){
          this[name] = funcArg(this, value, idx, this[name])
        }) :
        (this[0] && this[0][name])
    },
    data: function(name, value){
      var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

      var data = (1 in arguments) ?
        this.attr(attrName, value) :
        this.attr(attrName)

      return data !== null ? deserializeValue(data) : undefined
    },
    val: function(value){
      return 0 in arguments ?
        this.each(function(idx){
          this.value = funcArg(this, value, idx, this.value)
        }) :
        (this[0] && (this[0].multiple ?
           $(this[0]).find('option').filter(function(){ return this.selected }).pluck('value') :
           this[0].value)
        )
    },
    offset: function(coordinates){
      if (coordinates) return this.each(function(index){
        var $this = $(this),
            coords = funcArg(this, coordinates, index, $this.offset()),
            parentOffset = $this.offsetParent().offset(),
            props = {
              top:  coords.top  - parentOffset.top,
              left: coords.left - parentOffset.left
            }

        if ($this.css('position') == 'static') props['position'] = 'relative'
        $this.css(props)
      })
      if (!this.length) return null
      if (!$.contains(document.documentElement, this[0]))
        return {top: 0, left: 0}
      var obj = this[0].getBoundingClientRect()
      return {
        left: obj.left + window.pageXOffset,
        top: obj.top + window.pageYOffset,
        width: Math.round(obj.width),
        height: Math.round(obj.height)
      }
    },
    css: function(property, value){
      if (arguments.length < 2) {
        var computedStyle, element = this[0]
        if(!element) return
        computedStyle = getComputedStyle(element, '')
        if (typeof property == 'string')
          return element.style[camelize(property)] || computedStyle.getPropertyValue(property)
        else if (isArray(property)) {
          var props = {}
          $.each(property, function(_, prop){
            props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
          })
          return props
        }
      }

      var css = ''
      if (type(property) == 'string') {
        if (!value && value !== 0)
          this.each(function(){ this.style.removeProperty(dasherize(property)) })
        else
          css = dasherize(property) + ":" + maybeAddPx(property, value)
      } else {
        for (key in property)
          if (!property[key] && property[key] !== 0)
            this.each(function(){ this.style.removeProperty(dasherize(key)) })
          else
            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
      }

      return this.each(function(){ this.style.cssText += ';' + css })
    },
    index: function(element){
      return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
    },
    hasClass: function(name){
      if (!name) return false
      return emptyArray.some.call(this, function(el){
        return this.test(className(el))
      }, classRE(name))
    },
    addClass: function(name){
      if (!name) return this
      return this.each(function(idx){
        if (!('className' in this)) return
        classList = []
        var cls = className(this), newName = funcArg(this, name, idx, cls)
        newName.split(/\s+/g).forEach(function(klass){
          if (!$(this).hasClass(klass)) classList.push(klass)
        }, this)
        classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
      })
    },
    removeClass: function(name){
      return this.each(function(idx){
        if (!('className' in this)) return
        if (name === undefined) return className(this, '')
        classList = className(this)
        funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
          classList = classList.replace(classRE(klass), " ")
        })
        className(this, classList.trim())
      })
    },
    toggleClass: function(name, when){
      if (!name) return this
      return this.each(function(idx){
        var $this = $(this), names = funcArg(this, name, idx, className(this))
        names.split(/\s+/g).forEach(function(klass){
          (when === undefined ? !$this.hasClass(klass) : when) ?
            $this.addClass(klass) : $this.removeClass(klass)
        })
      })
    },
    scrollTop: function(value){
      if (!this.length) return
      var hasScrollTop = 'scrollTop' in this[0]
      if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
      return this.each(hasScrollTop ?
        function(){ this.scrollTop = value } :
        function(){ this.scrollTo(this.scrollX, value) })
    },
    scrollLeft: function(value){
      if (!this.length) return
      var hasScrollLeft = 'scrollLeft' in this[0]
      if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
      return this.each(hasScrollLeft ?
        function(){ this.scrollLeft = value } :
        function(){ this.scrollTo(value, this.scrollY) })
    },
    position: function() {
      if (!this.length) return

      var elem = this[0],
        // Get *real* offsetParent
        offsetParent = this.offsetParent(),
        // Get correct offsets
        offset       = this.offset(),
        parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

      // Subtract element margins
      // note: when an element has margin: auto the offsetLeft and marginLeft
      // are the same in Safari causing offset.left to incorrectly be 0
      offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
      offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

      // Add offsetParent borders
      parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
      parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

      // Subtract the two offsets
      return {
        top:  offset.top  - parentOffset.top,
        left: offset.left - parentOffset.left
      }
    },
    offsetParent: function() {
      return this.map(function(){
        var parent = this.offsetParent || document.body
        while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
          parent = parent.offsetParent
        return parent
      })
    }
  }

  // for now
  $.fn.detach = $.fn.remove

  // Generate the `width` and `height` functions
  ;['width', 'height'].forEach(function(dimension){
    var dimensionProperty =
      dimension.replace(/./, function(m){ return m[0].toUpperCase() })

    $.fn[dimension] = function(value){
      var offset, el = this[0]
      if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
        isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
        (offset = this.offset()) && offset[dimension]
      else return this.each(function(idx){
        el = $(this)
        el.css(dimension, funcArg(this, value, idx, el[dimension]()))
      })
    }
  })

  function traverseNode(node, fun) {
    fun(node)
    for (var i = 0, len = node.childNodes.length; i < len; i++)
      traverseNode(node.childNodes[i], fun)
  }

  // Generate the `after`, `prepend`, `before`, `append`,
  // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
  adjacencyOperators.forEach(function(operator, operatorIndex) {
    var inside = operatorIndex % 2 //=> prepend, append

    $.fn[operator] = function(){
      // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
      var argType, nodes = $.map(arguments, function(arg) {
            argType = type(arg)
            return argType == "object" || argType == "array" || arg == null ?
              arg : zepto.fragment(arg)
          }),
          parent, copyByClone = this.length > 1
      if (nodes.length < 1) return this

      return this.each(function(_, target){
        parent = inside ? target : target.parentNode

        // convert all methods to a "before" operation
        target = operatorIndex == 0 ? target.nextSibling :
                 operatorIndex == 1 ? target.firstChild :
                 operatorIndex == 2 ? target :
                 null

        var parentInDocument = $.contains(document.documentElement, parent)

        nodes.forEach(function(node){
          if (copyByClone) node = node.cloneNode(true)
          else if (!parent) return $(node).remove()

          parent.insertBefore(node, target)
          if (parentInDocument) traverseNode(node, function(el){
            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
               (!el.type || el.type === 'text/javascript') && !el.src)
              window['eval'].call(window, el.innerHTML)
          })
        })
      })
    }

    // after    => insertAfter
    // prepend  => prependTo
    // before   => insertBefore
    // append   => appendTo
    $.fn[inside ? operator+'To' : 'insert'+(operatorIndex ? 'Before' : 'After')] = function(html){
      $(html)[operator](this)
      return this
    }
  })

  zepto.Z.prototype = Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  zepto.uniq = uniq
  zepto.deserializeValue = deserializeValue
  $.zepto = zepto

  return $
})()

// If `$` is not yet defined, point it to `Zepto`
window.Zepto = Zepto
window.$ === undefined && (window.$ = Zepto)
