// node_modules/preact/dist/preact.mjs
var n;
var t;
var i;
var r;
var u;
var f;
var o;
var e;
var l;
var c;
var a;
var s;
var h = {};
var p = [];
var v = /^m(i|n|o|s|text|space)$/;
var y = Array.isArray;
var d = p.slice;
var w = Object.assign;
function _(n) {
  n && n.parentNode && n.remove();
}
function b(i, r, u, f, o) {
  var e = { type: i, props: r, key: u, ref: f, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: undefined, __v: o || ++t, __i: -1, __u: 0 };
  return !o && n.vnode && n.vnode(e), e;
}
function M(n) {
  return n.children;
}
function $(n, t) {
  this.props = n, this.context = t, this.__g = 0;
}
function x(n, t) {
  if (t == null)
    return n.__ ? x(n.__, n.__i + 1) : null;
  for (var i;t < n.__k.length; t++)
    if ((i = n.__k[t]) && i.__e)
      return i.__e;
  return typeof n.type != "function" || n.props.__P ? null : x(n);
}
function S(n) {
  if ((n = n.__) && n.__c && !n.props.__P)
    return n.__e = null, n.__k.some(function(t) {
      return t && (n.__e = t.__e);
    }), S(n);
}
function C(t) {
  (8 & t.__g || !(t.__g |= 8) || !r.push(t) || f++) && u == n.debounceRendering || ((u = n.debounceRendering) || queueMicrotask)(j);
}
function j() {
  var t, i, u, e, l, c, a, s, h;
  try {
    for (i = 1;r.length; )
      r.length > i && r.sort(o), t = r.shift(), i = r.length, 8 & t.__g && (e = undefined, l = undefined, c = (l = (u = t).__v).__e, a = [], s = [], (h = u.__P) && ((e = w({ constructor: undefined }, l)).__v = l.__v + 1, n.vnode && n.vnode(e), N(h, e, l, u.__n, h.namespaceURI, 32 & l.__u ? [c] : null, a, c || x(l), 32 & l.__u, s), e.__v = l.__v, e.__.__k[e.__i] = e, z(a, e, s), l.__ = l.__e = null, e.__e != c && S(e)));
  } finally {
    r.length = f = 0;
  }
}
function L(n, t, i, r, u, f, o, e, l, c, a) {
  var s, v, y, d, w, _, g = r.__k || p, k = t.length;
  for (l = H(i, t, g, l, k), s = 0;s < k; s++)
    (y = i.__k[s]) != null && (v = ~y.__i && g[y.__i] || h, y.__i = s, _ = N(n, y, v, u, f, o, e, l, c, a), d = y.__e, (v.ref != y.ref || 8 & v.__u) && (v.ref && D(v.ref, null, y, v), y.ref && a.push(y.ref, y.__c || d, y)), w = w || d, 4 & y.__u ? (l = I(y, l, n, !v.__v), v.__e && (v.__e = null)) : typeof y.type == "function" && _ !== undefined ? l = _ : d && (l = d.nextSibling), y.__u &= -7);
  return i.__e = w, l;
}
function H(n, t, i, r, u) {
  var f, o, e, l, c, a, s, h, p, v, d = i.length, w = d, _ = 0, g = false, k = n.__k = Array(u);
  for (f = 0;f < u; f++)
    (o = t[f]) != null && typeof o != "boolean" && typeof o != "function" ? (typeof o != "object" || o.constructor == String ? o = k[f] = b(null, o) : y(o) ? o = k[f] = b(M, { children: o }) : o.constructor === undefined && o.__b ? o = k[f] = b(o.type, o.props, o.key, o.ref, o.__v) : k[f] = o, l = f + _, o.__ = n, o.__b = n.__b + 1, e = null, ~(c = o.__i = O(o, i, l, w)) && (w--, (e = i[c]) && (e.__u |= 2)), e && e.__v ? (o.__u |= 2, c == l - 1 ? _-- : c == l + 1 ? _++ : c != l && (c > l ? _-- : _++, g = true)) : (~c || (u > d ? _-- : u < d && _++), typeof o.type != "function" && (o.__u |= 4))) : k[f] = null;
  if (g) {
    for (a = [], s = [], f = 0;f < u; f++)
      if ((o = k[f]) && 2 & o.__u) {
        for (h = 0, p = a.length;h < p; )
          a[v = h + p >> 1] < o.__i ? h = v + 1 : p = v;
        a[h] = o.__i, s[f] = h + 1;
      }
    for (_ = a.length;f--; )
      s[f] && (s[f] == _ ? _-- : k[f].__u |= 4);
  }
  if (w)
    for (f = 0;f < d; f++)
      !(e = i[f]) || 2 & e.__u || (e.__e == r && (r = x(e)), E(e, e));
  return r;
}
function I(n, t, i, r) {
  var u, f, o;
  if (typeof n.type == "function") {
    if (n.props.__P)
      return t;
    if (u = n.__k)
      for (f = 0;f < u.length; f++)
        u[f] && (u[f].__ = n, t = I(u[f], t, i, false));
    return t;
  }
  for (t && !t.parentNode && (t = x(n)) && !t.parentNode && (t = null), o = t;o && o.nodeType == 8; )
    o = o.nextSibling;
  for (n.__e != o && (!r && i.moveBefore && n.__e.parentNode ? i.moveBefore(n.__e, t) : i.insertBefore(n.__e, t || null)), t = n.__e;(t = t && t.nextSibling) && t.nodeType == 8; )
    ;
  return t;
}
function O(n, t, i, r) {
  var u, f, o, { key: e, type: l } = n, c = t[i], a = c && !(2 & c.__u);
  if (c === null && e == null || a && e == c.key && l == c.type)
    return i;
  if (r > (a ? 1 : 0)) {
    for (u = i - 1, f = i + 1;u >= 0 || f < t.length; )
      if ((c = t[o = u >= 0 ? u-- : f++]) && !(2 & c.__u) && e == c.key && l == c.type)
        return o;
  }
  return -1;
}
function P(n, t, i) {
  i == null && (i = ""), t[0] == "-" ? n.setProperty(t, i) : n[t] = i;
}
function T(n, t, i, r, u) {
  var f, o;
  n:
    if (t == "style")
      if (typeof i == "string")
        n.style.cssText = i;
      else {
        if (typeof r == "string" && (n.style.cssText = r = ""), r)
          for (t in r)
            i && t in i || P(n.style, t, "");
        if (i)
          for (t in i)
            r && i[t] == r[t] || P(n.style, t, i[t]);
      }
    else if (t[0] == "o" && t[1] == "n")
      (n.__e || (n.__e = {}))[t] = i, i && r || (o = a[t] || (a[t] = q(t)), (n.__a || (n.__a = {}))[t] = c, f = t != (t = t.replace(l, "$1")), (t = t.slice(2))[0] < "a" && (t = t.toLowerCase()), i ? n.addEventListener(t, o, f) : n.removeEventListener(t, o, f));
    else {
      if (u == "http://www.w3.org/2000/svg")
        t = t.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
      else if (t != "width" && t != "height" && t != "href" && t != "list" && t != "form" && t != "tabIndex" && t != "download" && t != "rowSpan" && t != "colSpan" && t != "role" && t != "popover" && t in n)
        try {
          n[t] = i == null ? "" : i;
          break n;
        } catch (n) {}
      typeof i == "function" || (i == null || i === false && t[4] != "-" ? n.removeAttribute(t) : n.setAttribute(t, t == "popover" && i == 1 ? "" : i));
    }
}
function q(t) {
  return function(i) {
    if (this.__e) {
      var r = this.__e[t];
      if (i[e] == null)
        i[e] = c++;
      else if (i[e] < this.__a[t])
        return;
      return r(n.event ? n.event(i) : i);
    }
  };
}
function N(t, i, r, u, f, o, e, l, c, a) {
  var s, h, v, d, g, k, b, m, S, C, j, H, I, A, O, P, T, q, N, z, D = i.type;
  if (i.constructor !== undefined)
    return null;
  if (128 & r.__u && (c = 32 & r.__u, s = r.__c.__z)) {
    if (i.__u |= c, h = o = [], s.nodeType == 8)
      for (v = 1, d = s.nextSibling;d; d = d.nextSibling) {
        if (d.nodeType == 8) {
          if (d.data.startsWith("$s"))
            v++;
          else if (d.data.startsWith("/$s") && !--v)
            break;
        }
        o.push(d);
      }
    else
      o.push(s);
    l = o[0];
  }
  (s = n.__b) && s(i);
  n:
    if (typeof D == "function") {
      g = e.length;
      try {
        if (C = i.props, j = (s = D.prototype) && s.render, H = (s = D.contextType) && u[s.__c], I = s ? H ? H.props.value : s.__ : u, r.__c ? 2 & (k = i.__c = r.__c).__g && (k.__g |= 1) : (j ? i.__c = k = new D(C, I) : (i.__c = k = new $(C, I), k.constructor = D, k.render = F), H && H.sub(k), k.state || (k.state = {}), k.__n = u, k.__g |= 8, k.__h = [], k.__k = []), j && (k.__s || (k.__s = k.state), D.getDerivedStateFromProps && (k.__s == k.state && (k.__s = w({}, k.__s)), w(k.__s, D.getDerivedStateFromProps(C, k.__s)))), b = k.props, m = k.state, k.__v = i, r.__c) {
          if (j && !D.getDerivedStateFromProps && C !== b && k.componentWillReceiveProps && k.componentWillReceiveProps(C, I), i.__v == r.__v && !(8 & k.__g) || !(4 & k.__g) && k.shouldComponentUpdate && k.shouldComponentUpdate(C, k.__s, I) === false) {
            i.__v != r.__v && (k.props = C, k.state = k.__s, k.__g &= -9), i.__e = r.__e, i.__k = r.__k, i.__k.some(function(n) {
              n && (n.__ = i);
            }), p.push.apply(k.__h, k.__k), k.__k = [], k.__h.length && e.push(k), l = x(r);
            break n;
          }
          k.componentWillUpdate && k.componentWillUpdate(C, k.__s, I), j && k.componentDidUpdate && k.__h.push(function() {
            k.componentDidUpdate(b, m, S);
          });
        } else
          j && !D.getDerivedStateFromProps && k.componentWillMount && k.componentWillMount(), j && k.componentDidMount && k.__h.push(k.componentDidMount);
        if (k.context = I, k.props = C, k.__P = t, k.__g &= -5, A = n.__r, O = 0, j)
          k.state = k.__s, k.__g &= -9, A && A(i), s = k.render(k.props, k.state, k.context), p.push.apply(k.__h, k.__k), k.__k = [];
        else
          do {
            k.__g &= -9, A && A(i), s = k.render(k.props, k.state, k.context), k.state = k.__s;
          } while (8 & k.__g && ++O < 25);
        k.state = k.__s, k.getChildContext && (u = w({}, u, k.getChildContext())), j && r.__c && k.getSnapshotBeforeUpdate && (S = k.getSnapshotBeforeUpdate(b, m)), P = s && s.type === M && s.key == null ? s.props.children : s, C.__P && (s = l, f = (t = C.__P).namespaceURI, c = o = null, r.props && r.props.__P != t && (r.__k.some(function(n) {
          n && E(n, n);
        }), r.__k = null), l = r.__k ? x(r, 0) : null), l = L(t, y(P) ? P : [P], i, r, u, f, o, e, l, c, a), C.__P && (i.__e = null, l = s), i.__u &= -161, 128 & r.__u && (k.__z = null), h && h.some(_), k.__h.length && e.push(k), 1 & k.__g && (k.__g &= -4);
      } catch (t) {
        if (e.length = g, i.__v = null, c || o)
          if (t.then) {
            if (T = 0, i.__u |= c ? 160 : 128, o) {
              for (~(N = o.indexOf(l || undefined)) || (N = o.length);(z = o[N - 1]) && z.nodeType == 8; )
                N--;
              for (;N < o.length; N++)
                if (z = o[N]) {
                  if (o[N] = null, z.nodeType == 8) {
                    if (z.data.startsWith("$s"))
                      T++ || (q = z);
                    else if (T && z.data.startsWith("/$s") && !--T) {
                      l = z;
                      break;
                    }
                  } else if (!T)
                    break;
                }
            }
            if (!q) {
              for (;l && l.nodeType == 8 && l.nextSibling; )
                l = l.nextSibling;
              q = l;
            }
            i.__c.__z || (i.__c.__z = q), i.__e = l;
          } else
            o && o.some(_);
        else
          i.__e = r.__e;
        i.__k || (i.__k = r.__k || []), t.then || V(i), n.__e(t, i, r);
      }
    } else
      l = i.__e = B(r.__e, i, r, u, f, o, e, c, a, t);
  return (s = n.diffed) && s(i), 128 & i.__u ? undefined : l;
}
function V(n) {
  n && (n.__c && (n.__c.__g |= 4), n.__k && n.__k.some(V));
}
function z(t, i, r) {
  for (var u = 0;u < r.length; )
    D(r[u++], r[u++], r[u++]);
  n.__c && n.__c(i, t), t.some(function(i) {
    try {
      t = i.__h, i.__h = [], t.some(function(n) {
        n.call(i);
      });
    } catch (t) {
      n.__e(t, i.__v);
    }
  });
}
function B(t, i, r, u, f, o, e, l, c, a) {
  var s, p, w, g, k, b, m, M, $, S = r.props || h, { props: C, type: j } = i;
  if (j == "svg" ? f = "http://www.w3.org/2000/svg" : j == "math" ? f = "http://www.w3.org/1998/Math/MathML" : f || (f = "http://www.w3.org/1999/xhtml"), o) {
    for (s = 0;s < o.length; s++)
      if ((k = o[s]) && (j ? k.localName == j : k.nodeType == 3)) {
        t = k, o[s] = null;
        break;
      }
  }
  if (!t) {
    if (M = a.ownerDocument || document, !j)
      return M.createTextNode(C);
    t = M.createElementNS(f, j, C.is && C), l && (n.__m && n.__m(i, o), l = false), o = null;
  }
  if (j) {
    if (a = j == "template" ? t.content : t, o = j == "textarea" && C.defaultValue != null ? null : o && d.call(a.childNodes), !l && o)
      for (S = {}, s = 0;s < t.attributes.length; s++)
        S[(k = t.attributes[s]).name] = k.value;
    for (s in S)
      k = S[s], s == "dangerouslySetInnerHTML" ? w = k : s == "children" || (s in C) || s == "value" && ("defaultValue" in C) || s == "checked" && ("defaultChecked" in C) || T(t, s, null, k, f);
    for (s in $ = 1 & r.__u, C)
      k = C[s], s == "children" ? g = k : s == "dangerouslySetInnerHTML" ? p = k : s == "value" ? b = k : s == "checked" ? m = k : l && typeof k != "function" || !(S[s] !== k || $ && k != null) || T(t, s, k, S[s], f);
    p ? (l || w && (p.__html == w.__html || p.__html == t.innerHTML) || (t.innerHTML = p.__html), i.__k = []) : (w && (t.textContent = ""), (j == "foreignObject" || f == "http://www.w3.org/1998/Math/MathML" && v.test(j)) && (f = "http://www.w3.org/1999/xhtml"), L(a, y(g) ? g : [g], i, r, u, f, o, e, o ? o[0] : r.__k && x(r, 0), l, c), o && o.some(_)), l && j != "textarea" || (s = "value", j == "progress" && b == null ? t.removeAttribute(s) : b == null || b === t[s] && (j != "progress" || b) || T(t, s, b, S[s], f), s = "checked", m != null && m != t[s] && T(t, s, m, S[s], f));
  } else
    S === C || l && t.data == C || (t.data = C);
  return t;
}
function D(t, i, r, u) {
  try {
    typeof t == "function" ? i ? i.__x = t(i) || 1 : u && (u = u.__c || u.__e) && (i = u.__x) && (u.__x = null, typeof i == "function" ? i() : t(null)) : t.current = i;
  } catch (t) {
    n.__e(t, r);
  }
}
function E(t, i, r) {
  var u, f;
  if (n.unmount && n.unmount(t), !(u = t.ref) || u.current && u.current != t.__e || D(u, null, i, t), u = t.__c) {
    if (u.componentWillUnmount)
      try {
        u.componentWillUnmount();
      } catch (t) {
        n.__e(t, i);
      }
    u.__P = u.__n = null;
  }
  if (u = t.__k)
    for (f = 0;f < u.length; f++)
      u[f] && E(u[f], i, typeof t.type != "function" || r && !t.props.__P);
  (u = t.__e) && (r || _(u), u.__e && (u.__e = null)), t.__e = t.__c = t.__ = null;
}
function F(n, t, i) {
  return this.constructor(n, i);
}
function G(t, i) {
  var r, u, f, o;
  n.__ && n.__(t, i), i.nodeType == 9 && (i = i.documentElement), u = (r = t && 32 & t.__u) ? null : i.__k, i.__k = b(M, { children: [t] }), f = [], o = [], N(i, i.__k, u || h, h, i.namespaceURI, u ? null : i.firstChild ? d.call(i.childNodes) : null, f, u ? u.__e : i.firstChild, r, o), z(f, i.__k, o), i.__k.props.children = null;
}
n = { __e: function(n, t, i, r) {
  for (var u, o, e;t = t.__; )
    if ((u = t.__c) && !(1 & u.__g)) {
      u.__g |= 4;
      try {
        if ((o = u.constructor) && o.getDerivedStateFromError && (u.setState(o.getDerivedStateFromError(n)), e = 8 & u.__g), u.componentDidCatch && (u.componentDidCatch(n, r || {}), e = 8 & u.__g), e)
          return void (u.__g |= 2);
      } catch (t) {
        n = t, e = 0;
      }
    }
  throw f = 0, n;
} }, t = 0, i = function(n) {
  return n != null && n.constructor === undefined;
}, $.prototype.setState = function(n, t) {
  var i = this.__s;
  i && i != this.state || (i = this.__s = w({}, this.state)), typeof n == "function" && (n = n(w({}, i), this.props)), n && (w(i, n), this.__v && (t && this.__k.push(t), C(this)));
}, $.prototype.forceUpdate = function(n) {
  this.__v && (this.__g |= 4, n && this.__h.push(n), C(this));
}, $.prototype.render = M, r = [], f = 0, o = function(n, t) {
  return n.__v.__b - t.__v.__b;
}, e = Symbol(), l = /(PointerCapture)$|Capture$/i, c = 0, a = {}, s = 0;

// node_modules/preact/hooks/dist/hooks.mjs
var t2;
var r2;
var u2;
var i2;
var o2 = Object.is;
var f2 = 0;
var c2 = [];
var e2 = [];
var a2 = n;
var v2 = a2.__b;
var l2 = a2.__r;
var m = a2.diffed;
var s2 = a2.__c;
var h2 = a2.unmount;
var p2 = a2.__;
function y2(n, t) {
  a2.__h && a2.__h(r2, n, f2 || t), f2 = 0;
  var u = r2.__H || (r2.__H = { __: [], __h: [] });
  return n >= u.__.length && u.__.push({}), u.__[n];
}
function d2(n) {
  return f2 = 1, _2(G2, n);
}
function _2(n, u, i) {
  var f = y2(t2++, 2);
  if (f.t = n, !f.__c && (f.__ = [i ? i(u) : G2(undefined, u), function(n) {
    var t = f.__N ? f.__N[0] : f.__[0], r = f.t(t, n);
    o2(t, r) || (f.__N = [r, f.__[1]], f.__c.setState({}));
  }], f.__c = r2, !r2.__f)) {
    r2.__f = true;
    var c = r2.shouldComponentUpdate;
    r2.shouldComponentUpdate = function(n, t, r) {
      var u = this.__H;
      if (!u)
        return true;
      var i = false, f = this.props != n;
      if (u.__.some(function(n) {
        n.__N && (i = true, o2(n.__[0], n.__N[0]) || (f = true));
      }), c) {
        var e = c.call(this, n, t, r);
        return i ? e || f : e;
      }
      return !i || f;
    };
  }
  return f.__;
}
function A(n, u) {
  var i = y2(t2++, 3);
  !a2.__s && E2(i.__H, u) && (i.__P = true, i.__ = n, i.u = u, r2.__H.__h.push(i));
}
function T2(n) {
  return f2 = 5, b2(function() {
    return { current: n };
  }, []);
}
function b2(n, r) {
  var u = y2(t2++, 7);
  return E2(u.__H, r) && (u.__ = n(), u.__H = r), u.__;
}
function g() {
  var n;
  do {
    for (;n = e2.shift(); )
      try {
        C2(n);
      } catch (t) {
        a2.__e(t, { __: (n = n.__P) && n.__v });
      }
    for (;n = c2.shift(); ) {
      var t = n.__H;
      if (n.__P && t)
        try {
          t.__h.some(C2), t.__h.some(D2), t.__h = [];
        } catch (r) {
          t.__h = [], a2.__e(r, n.__v);
        }
    }
  } while (e2.length);
}
a2.__b = function(n) {
  r2 = null, v2 && v2(n);
}, a2.__ = function(n, t) {
  n && t.__k && t.__k.__m && (n.__m = t.__k.__m), p2 && p2(n, t);
}, a2.__r = function(n) {
  l2 && l2(n), t2 = 0;
  var i = (r2 = n.__c).__H;
  i && (u2 == r2 ? r2.__h = [] : (i.__h.some(C2), i.__h.some(D2), t2 = 0), i.__h = [], i.__.some(function(n) {
    n.__N && (n.__ = n.__N), n.u = n.__N = undefined;
  })), u2 = r2;
}, a2.diffed = function(n) {
  m && m(n);
  var t = n.__c;
  t && t.__H && (t.__H.__h.length && B2(c2.push(t)), t.__H.__.some(function(n) {
    n.u && (n.__H = n.u);
  })), u2 = r2 = null;
}, a2.__c = function(n, t) {
  t.some(function(n) {
    try {
      n.__h.some(C2), n.__h = n.__h.filter(function(n) {
        return !n.__ || D2(n);
      });
    } catch (r) {
      t.some(function(n) {
        n.__h && (n.__h = []);
      }), t = [], a2.__e(r, n.__v);
    }
  }), s2 && s2(n, t);
}, a2.unmount = function(n) {
  h2 && h2(n);
  var t, r, u = n.__c;
  u && u.__H && (u.__H.__.some(function(u) {
    try {
      if (u.__P && u.__c) {
        if (r === undefined) {
          for (r = n.__;r && (!r.__c || !r.__c.__P); )
            r = r.__;
          r = r && r.__c;
        }
        u.__P = r, B2(e2.push(u));
      } else
        C2(u);
    } catch (n) {
      t = n;
    }
  }), u.__H = undefined, t && a2.__e(t, u.__v));
};
var k = typeof requestAnimationFrame == "function";
function z2(n) {
  var t, r = function() {
    clearTimeout(u), k && cancelAnimationFrame(t), setTimeout(n);
  }, u = setTimeout(r, 35);
  k && (t = requestAnimationFrame(r));
}
function B2(n) {
  n != 1 && i2 == a2.requestAnimationFrame || ((i2 = a2.requestAnimationFrame) || z2)(g);
}
function C2(n) {
  var t = r2, u = n.__c;
  typeof u == "function" && (n.__c = undefined, u()), r2 = t;
}
function D2(n) {
  var t = r2;
  n.__c = n.__(), r2 = t;
}
function E2(n, t) {
  return !n || n.length != t.length || t.some(function(t, r) {
    return !o2(t, n[r]);
  });
}
function G2(n, t) {
  return typeof t == "function" ? t(n) : t;
}

// src/shared/json.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/shared/bridge.ts
var STUDIO_EXTENSION = "lumi_rp_engine_studio";
var STATE_EVENT = "lre-state-v1";
var STATE_REQUEST_EVENT = "lre-state-request-v1";
var OFFER_EVENT = "lre-studio-offer-v1";
var INSTALLED_EVENT = "lre-studio-installed-v1";
var OFFER_INBOUND = `rpc:${STUDIO_EXTENSION}.offer`;
var encoder = new TextEncoder;
var str = (v) => typeof v === "string";
function readInstalled(value) {
  if (!isRecord(value) || !str(value.offerId) || !str(value.worldId) || !str(value.revision))
    return null;
  if (value.mode !== "new" && value.mode !== "revision")
    return null;
  return { offerId: value.offerId, mode: value.mode, worldId: value.worldId, revision: value.revision };
}
// node_modules/preact/jsx-runtime/dist/jsxRuntime.mjs
var o3 = 0;
function u3(t, e, n2, f, u, i) {
  e || (e = {});
  var a, c, l = e;
  if ("ref" in l && typeof t != "function")
    for (c in l = {}, e)
      c == "ref" ? a = e[c] : l[c] = e[c];
  var p = { type: t, props: l, key: n2, ref: a, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: undefined, __v: --o3, __i: -1, __u: 0 };
  return (u || i) && (p.__source = u, p.__self = i), n.vnode && n.vnode(p), p;
}

// src/frontend/app.tsx
var KIND_LABEL = { chat: "This chat", character: "A character", books: "Lore books", blank: "Blank", world: "A LumiRPEngine world" };
function message(error) {
  return error instanceof Error ? error.message : String(error);
}
function App(props) {
  const { client, host } = props;
  const [drafts, setDrafts] = d2([]);
  const [draft, setDraft] = d2(null);
  const [settings, setSettings] = d2(null);
  const [connections, setConnections] = d2([]);
  const [engine, setEngine] = d2(null);
  const [notice, setNotice] = d2(null);
  const [busy, setBusy] = d2(false);
  const [creating, setCreating] = d2(false);
  const [chatId, setChatId] = d2(host.activeChat());
  const open = T2(null);
  open.current = draft?.id ?? null;
  const act = async (work) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      setNotice({ text: message(error), error: true });
    } finally {
      setBusy(false);
    }
  };
  A(() => {
    act(async () => {
      const hello = await client.request({ type: "hello" });
      setDrafts(hello.drafts);
      setSettings(hello.settings);
      setConnections(hello.connections);
      const first = hello.drafts[0];
      if (first)
        setDraft((await client.request({ type: "draft.open", draftId: first.id })).draft);
      else
        setCreating(true);
    });
    const offPush = client.onPush((push) => {
      if (push.type === "drafts")
        setDrafts(push.drafts);
      else if (push.type === "draft") {
        if (push.draft.id === open.current)
          setDraft(push.draft);
      } else if (push.draftId === open.current)
        setDraft((d) => d ? { ...d, chat: [...d.chat, push.line] } : d);
    });
    const onState = (event) => {
      const detail = event.detail;
      if (isRecord(detail) && typeof detail.engineVersion === "string")
        setEngine({ version: detail.engineVersion, offers: Array.isArray(detail.inbound) && detail.inbound.includes(OFFER_INBOUND) });
    };
    const onInstalled = (event) => {
      const installed = readInstalled(event.detail);
      if (!installed)
        return;
      client.request({ type: "installed", ...installed }).then((r) => {
        if (r.draft && r.draft.id === open.current)
          setDraft(r.draft);
        if (r.draft)
          setNotice({ text: `LumiRPEngine installed “${r.draft.name}”.`, error: false });
      });
    };
    window.addEventListener(STATE_EVENT, onState);
    window.addEventListener(INSTALLED_EVENT, onInstalled);
    window.dispatchEvent(new CustomEvent(STATE_REQUEST_EVENT, { detail: { version: 1 } }));
    const offChat = host.onChatChange(() => setChatId(host.activeChat()));
    return () => {
      offPush();
      offChat();
      window.removeEventListener(STATE_EVENT, onState);
      window.removeEventListener(INSTALLED_EVENT, onInstalled);
    };
  }, []);
  const openDraft = (id) => act(async () => {
    setCreating(false);
    setDraft((await client.request({ type: "draft.open", draftId: id })).draft);
  });
  return /* @__PURE__ */ u3("div", {
    class: "lres",
    "data-lres": true,
    children: [
      /* @__PURE__ */ u3("div", {
        class: "lres-card",
        children: [
          /* @__PURE__ */ u3("div", {
            class: "lres-h",
            children: [
              /* @__PURE__ */ u3("span", {
                children: "RPEngine Studio"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("span", {
                class: "lres-muted",
                children: engine ? `LumiRPEngine ${engine.version}${engine.offers ? "" : " (too old to install from the Studio)"}` : "LumiRPEngine not seen yet"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ u3("div", {
            class: "lres-row",
            children: [
              /* @__PURE__ */ u3("select", {
                class: "lres-input lres-grow",
                "aria-label": "Draft",
                value: draft?.id ?? "",
                onChange: (e) => e.currentTarget.value && void openDraft(e.currentTarget.value),
                children: [
                  /* @__PURE__ */ u3("option", {
                    value: "",
                    children: drafts.length === 0 ? "No drafts yet" : "Open a draft…"
                  }, undefined, false, undefined, this),
                  drafts.map((d) => /* @__PURE__ */ u3("option", {
                    value: d.id,
                    children: d.name
                  }, d.id, false, undefined, this))
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn",
                onClick: () => setCreating(!creating),
                children: creating ? "Close" : "New draft"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          settings ? /* @__PURE__ */ u3("div", {
            class: "lres-row",
            children: [
              /* @__PURE__ */ u3("select", {
                class: "lres-input lres-grow",
                "aria-label": "Connection",
                value: settings.connectionId ?? "",
                onChange: (e) => void act(async () => setSettings((await client.request({ type: "settings.set", connectionId: e.currentTarget.value || null })).settings)),
                children: [
                  /* @__PURE__ */ u3("option", {
                    value: "",
                    children: "Your active connection"
                  }, undefined, false, undefined, this),
                  connections.map((c) => /* @__PURE__ */ u3("option", {
                    value: c.id,
                    children: [
                      c.name,
                      c.model ? ` · ${c.model}` : ""
                    ]
                  }, c.id, true, undefined, this))
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ u3("label", {
                class: "lres-muted",
                children: [
                  "Model calls per message",
                  " ",
                  /* @__PURE__ */ u3("input", {
                    class: "lres-input",
                    style: { width: "72px" },
                    type: "number",
                    min: 1,
                    max: 120,
                    value: settings.maxRounds,
                    onChange: (e) => void act(async () => setSettings((await client.request({ type: "settings.set", maxRounds: Number(e.currentTarget.value) })).settings))
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this) : null
        ]
      }, undefined, true, undefined, this),
      notice ? /* @__PURE__ */ u3("div", {
        class: notice.error ? "lres-banner error" : "lres-banner",
        onClick: () => setNotice(null),
        children: notice.text
      }, undefined, false, undefined, this) : null,
      creating ? /* @__PURE__ */ u3(NewDraft, {
        client,
        chatId,
        busy,
        act,
        created: (d) => {
          setCreating(false);
          setDraft(d);
          client.request({ type: "draft.list" }).then((r) => setDrafts(r.drafts));
        }
      }, undefined, false, undefined, this) : null,
      draft && !creating ? /* @__PURE__ */ u3(DraftPanel, {
        client,
        host,
        draft,
        chatId,
        busy,
        act,
        setDraft,
        notify: (text) => setNotice({ text, error: false }),
        deleted: (list) => {
          setDrafts(list);
          setDraft(null);
          setCreating(list.length === 0);
        },
        renamed: () => void client.request({ type: "draft.list" }).then((r) => setDrafts(r.drafts))
      }, draft.id, false, undefined, this) : null
    ]
  }, undefined, true, undefined, this);
}
function NewDraft(props) {
  const { client } = props;
  const [kind, setKind] = d2(props.chatId ? "chat" : "blank");
  const [name, setName] = d2("");
  const [chat, setChat] = d2(null);
  const [characters, setCharacters] = d2(null);
  const [books, setBooks] = d2(null);
  const [worlds, setWorlds] = d2(null);
  const [pick, setPick] = d2("");
  const [picked, setPicked] = d2([]);
  const [problem, setProblem] = d2(null);
  A(() => {
    setProblem(null);
    setPick("");
    const load = async () => {
      if (kind === "chat" && props.chatId)
        setChat((await client.request({ type: "pick.chat", chatId: props.chatId })).chat);
      if (kind === "character" && !characters)
        setCharacters((await client.request({ type: "pick.characters" })).items);
      if (kind === "books" && !books)
        setBooks((await client.request({ type: "pick.books" })).items);
      if (kind === "world" && !worlds)
        setWorlds((await client.request({ type: "pick.worlds" })).worlds);
    };
    load().catch((error) => setProblem(message(error)));
  }, [kind, props.chatId]);
  const spec = () => {
    if (kind === "chat")
      return props.chatId ? { kind, chatId: props.chatId } : null;
    if (kind === "character")
      return pick ? { kind, characterId: pick } : null;
    if (kind === "books")
      return picked.length > 0 ? { kind, bookIds: picked } : null;
    if (kind === "world")
      return pick ? { kind, worldId: pick, ...props.chatId && chat?.world?.worldId === pick ? { chatId: props.chatId } : {} } : null;
    return { kind: "blank" };
  };
  const ready = spec();
  return /* @__PURE__ */ u3("div", {
    class: "lres-card",
    "data-lres-new": true,
    children: [
      /* @__PURE__ */ u3("div", {
        class: "lres-h",
        children: "New draft"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ u3("input", {
        class: "lres-input",
        placeholder: "Name (optional)",
        "aria-label": "Draft name",
        value: name,
        onInput: (e) => setName(e.currentTarget.value)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ u3("div", {
        class: "lres-row",
        children: Object.keys(KIND_LABEL).map((k) => /* @__PURE__ */ u3("button", {
          type: "button",
          class: k === kind ? "lres-btn primary" : "lres-btn",
          disabled: k === "chat" && !props.chatId,
          onClick: () => setKind(k),
          children: KIND_LABEL[k]
        }, k, false, undefined, this))
      }, undefined, false, undefined, this),
      problem ? /* @__PURE__ */ u3("div", {
        class: "lres-banner error",
        children: problem
      }, undefined, false, undefined, this) : null,
      kind === "chat" && chat ? /* @__PURE__ */ u3("div", {
        class: "lres-muted",
        children: [
          "“",
          chat.name,
          "”: ",
          chat.messages,
          " messages",
          chat.characters.length > 0 ? ` with ${chat.characters.join(", ")}` : "",
          chat.books.length > 0 ? `; lore: ${chat.books.map((b) => `${b.name} (${b.scope})`).join(", ")}` : "; no lore books",
          ".",
          chat.world ? ` It already plays a LumiRPEngine world: pick “A LumiRPEngine world” to refine that world against this chat.` : ""
        ]
      }, undefined, true, undefined, this) : null,
      kind === "chat" && chat?.world ? /* @__PURE__ */ u3("button", {
        type: "button",
        class: "lres-btn",
        onClick: () => (setKind("world"), setPick(chat.world?.worldId ?? "")),
        children: "Refine this chat's world instead"
      }, undefined, false, undefined, this) : null,
      kind === "character" && characters ? /* @__PURE__ */ u3("select", {
        class: "lres-input",
        "aria-label": "Character",
        value: pick,
        onChange: (e) => setPick(e.currentTarget.value),
        children: [
          /* @__PURE__ */ u3("option", {
            value: "",
            children: "Choose a character…"
          }, undefined, false, undefined, this),
          characters.map((c) => /* @__PURE__ */ u3("option", {
            value: c.id,
            children: c.name
          }, c.id, false, undefined, this))
        ]
      }, undefined, true, undefined, this) : null,
      kind === "books" && books ? /* @__PURE__ */ u3("div", {
        class: "lres-chips",
        children: books.map((b) => /* @__PURE__ */ u3("label", {
          class: "lres-chip",
          children: [
            /* @__PURE__ */ u3("input", {
              type: "checkbox",
              checked: picked.includes(b.id),
              onChange: (e) => setPicked(e.currentTarget.checked ? [...picked, b.id] : picked.filter((x) => x !== b.id))
            }, undefined, false, undefined, this),
            " ",
            b.name
          ]
        }, b.id, true, undefined, this))
      }, undefined, false, undefined, this) : null,
      kind === "world" && worlds ? /* @__PURE__ */ u3("select", {
        class: "lres-input",
        "aria-label": "LumiRPEngine world",
        value: pick,
        onChange: (e) => setPick(e.currentTarget.value),
        children: [
          /* @__PURE__ */ u3("option", {
            value: "",
            children: "Choose a world…"
          }, undefined, false, undefined, this),
          worlds.map((w) => /* @__PURE__ */ u3("option", {
            value: w.id,
            children: [
              w.name,
              " (",
              w.revisionCount,
              " revision",
              w.revisionCount === 1 ? "" : "s",
              ")"
            ]
          }, w.id, true, undefined, this))
        ]
      }, undefined, true, undefined, this) : null,
      /* @__PURE__ */ u3("button", {
        type: "button",
        class: "lres-btn primary",
        disabled: !ready || props.busy,
        onClick: () => void props.act(async () => {
          if (ready)
            props.created((await client.request({ type: "draft.create", name, source: ready })).draft);
        }),
        children: "Start"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function DraftPanel(props) {
  const { client, draft, act } = props;
  const [text, setText] = d2("");
  const [pasteTitle, setPasteTitle] = d2("");
  const [pasteText, setPasteText] = d2("");
  const [declined, setDeclined] = d2([]);
  const [item, setItem] = d2({ collection: "", id: "", proposed: false, value: null });
  const [worlds, setWorlds] = d2(null);
  const [target, setTarget] = d2(draft.link?.worldId ?? "");
  const fileInput = T2(null);
  const chatEnd = T2(null);
  A(() => chatEnd.current?.scrollIntoView({ block: "nearest" }), [draft.chat.length]);
  A(() => setDeclined([]), [draft.review?.changes.length]);
  const show = (collection, id, proposed) => act(async () => {
    const r = await client.request({ type: "draft.item", draftId: draft.id, collection, id, proposed });
    setItem({ collection, id, proposed, value: r.value });
  });
  const install = (mode, attach) => act(async () => {
    if (attach && !props.chatId)
      throw new Error("Open the chat to attach it to first.");
    const r = await client.request({ type: "install", draftId: draft.id, mode, worldId: mode === "revision" ? target || null : null, attachChatId: attach ? props.chatId : null });
    window.dispatchEvent(new CustomEvent(OFFER_EVENT, { detail: { offerId: r.offerId } }));
    props.setDraft((await client.request({ type: "draft.open", draftId: draft.id })).draft);
    props.notify("Offered to LumiRPEngine: review it in its Build tab and tap Install there.");
  });
  const firstItem = Object.entries(draft.ids)[0];
  return /* @__PURE__ */ u3(M, {
    children: [
      /* @__PURE__ */ u3("div", {
        class: "lres-card",
        "data-lres-source": true,
        children: [
          /* @__PURE__ */ u3("div", {
            class: "lres-h",
            children: [
              /* @__PURE__ */ u3("span", {
                children: draft.name
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("span", {
                class: "lres-row",
                children: [
                  /* @__PURE__ */ u3("button", {
                    type: "button",
                    class: "lres-btn",
                    onClick: () => {
                      const name = window.prompt("Rename the draft", draft.name);
                      if (name)
                        act(async () => (props.setDraft((await client.request({ type: "draft.rename", draftId: draft.id, name })).draft), props.renamed()));
                    },
                    children: "Rename"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ u3("button", {
                    type: "button",
                    class: "lres-btn danger",
                    disabled: draft.running,
                    onClick: () => window.confirm(`Delete the draft “${draft.name}”?`) && void act(async () => props.deleted((await client.request({ type: "draft.delete", draftId: draft.id })).drafts)),
                    children: "Delete"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ u3("div", {
            class: "lres-muted",
            children: [
              draft.source.label,
              draft.source.books.length > 0 ? ` · lore: ${draft.source.books.map((b) => `${b.name} (${b.scope})`).join(", ")}` : "",
              draft.link ? ` · LumiRPEngine world ${draft.link.worldId}` : ""
            ]
          }, undefined, true, undefined, this),
          draft.source.pasted.map((p, i) => /* @__PURE__ */ u3("div", {
            class: "lres-row",
            children: [
              /* @__PURE__ */ u3("span", {
                class: "lres-chip",
                children: p.title
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("span", {
                class: "lres-muted",
                children: [
                  p.text.length,
                  " characters"
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn",
                onClick: () => void act(async () => props.setDraft((await client.request({ type: "draft.unpaste", draftId: draft.id, index: i })).draft)),
                children: "Remove"
              }, undefined, false, undefined, this)
            ]
          }, i, true, undefined, this)),
          /* @__PURE__ */ u3("details", {
            children: [
              /* @__PURE__ */ u3("summary", {
                class: "lres-muted",
                children: "Paste text for the assistant to read"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("input", {
                class: "lres-input",
                placeholder: "Title",
                value: pasteTitle,
                onInput: (e) => setPasteTitle(e.currentTarget.value)
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("textarea", {
                class: "lres-input",
                placeholder: "Setting notes, a history, character sheets…",
                value: pasteText,
                onInput: (e) => setPasteText(e.currentTarget.value)
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn",
                disabled: !pasteText.trim(),
                onClick: () => void act(async () => {
                  props.setDraft((await client.request({ type: "draft.paste", draftId: draft.id, title: pasteTitle, text: pasteText })).draft);
                  setPasteText("");
                  setPasteTitle("");
                }),
                children: "Add to sources"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ u3("div", {
        class: "lres-card",
        "data-lres-assistant": true,
        children: [
          /* @__PURE__ */ u3("div", {
            class: "lres-h",
            children: [
              /* @__PURE__ */ u3("span", {
                children: "Assistant"
              }, undefined, false, undefined, this),
              draft.running ? /* @__PURE__ */ u3("span", {
                class: "lres-muted",
                children: "working…"
              }, undefined, false, undefined, this) : null
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ u3("div", {
            class: "lres-chat",
            children: [
              draft.chat.map((line, i) => /* @__PURE__ */ u3("div", {
                class: `lres-line ${line.kind}${line.kind === "tool" && line.error ? " error" : ""}`,
                children: line.kind === "tool" ? `${line.error ? "✗" : "✓"} ${line.summary}` : line.text
              }, i, false, undefined, this)),
              /* @__PURE__ */ u3("div", {
                ref: chatEnd
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ u3("textarea", {
            class: "lres-input",
            "aria-label": "Message to the assistant",
            placeholder: draft.source.chatId ? "Convert this chat into a world whose start is the story's present." : "Describe the world you want.",
            value: text,
            onInput: (e) => setText(e.currentTarget.value)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ u3("div", {
            class: "lres-row",
            children: [
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn primary",
                disabled: draft.running || !text.trim(),
                onClick: () => void act(async () => {
                  await client.request({ type: "assistant.send", draftId: draft.id, text });
                  setText("");
                }),
                children: "Send"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn",
                disabled: !draft.running,
                onClick: () => void act(async () => void await client.request({ type: "assistant.stop", draftId: draft.id })),
                children: "Stop"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      draft.review ? /* @__PURE__ */ u3("div", {
        class: "lres-card",
        "data-lres-review": true,
        children: [
          /* @__PURE__ */ u3("div", {
            class: "lres-h",
            children: [
              /* @__PURE__ */ u3("span", {
                children: [
                  "Review the assistant's changes (",
                  draft.review.changes.length,
                  ")"
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ u3("span", {
                class: "lres-muted",
                children: [
                  draft.review.errors,
                  " errors · ",
                  draft.review.warnings,
                  " warnings"
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ u3("div", {
            class: "lres-chat",
            children: draft.review.changes.map((c) => /* @__PURE__ */ u3("label", {
              class: "lres-row",
              children: [
                /* @__PURE__ */ u3("input", {
                  type: "checkbox",
                  checked: !declined.includes(c.key),
                  onChange: (e) => setDeclined(e.currentTarget.checked ? declined.filter((k) => k !== c.key) : [...declined, c.key])
                }, undefined, false, undefined, this),
                /* @__PURE__ */ u3("span", {
                  class: "lres-chip",
                  children: c.kind
                }, undefined, false, undefined, this),
                /* @__PURE__ */ u3("span", {
                  class: "lres-grow",
                  children: c.label
                }, undefined, false, undefined, this)
              ]
            }, c.key, true, undefined, this))
          }, undefined, false, undefined, this),
          /* @__PURE__ */ u3("div", {
            class: "lres-row",
            children: [
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn primary",
                disabled: draft.running,
                onClick: () => void act(async () => props.setDraft((await client.request({ type: "review.accept", draftId: draft.id, keys: declined.length === 0 ? null : draft.review?.changes.filter((c) => !declined.includes(c.key)).map((c) => c.key) ?? [] })).draft)),
                children: declined.length === 0 ? "Accept all" : "Accept the ticked ones"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn danger",
                disabled: draft.running,
                onClick: () => void act(async () => props.setDraft((await client.request({ type: "review.discard", draftId: draft.id })).draft)),
                children: "Discard"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this) : null,
      /* @__PURE__ */ u3("div", {
        class: "lres-card",
        "data-lres-draft": true,
        children: [
          /* @__PURE__ */ u3("div", {
            class: "lres-h",
            children: [
              /* @__PURE__ */ u3("span", {
                children: [
                  draft.world.name,
                  " ",
                  /* @__PURE__ */ u3("span", {
                    class: "lres-muted",
                    children: [
                      "(",
                      draft.world.id,
                      ", POV ",
                      draft.world.pov,
                      ")"
                    ]
                  }, undefined, true, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ u3("span", {
                class: "lres-muted",
                children: [
                  draft.errors,
                  " errors · ",
                  draft.warnings,
                  " warnings"
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ u3("div", {
            class: "lres-chips",
            children: Object.entries(draft.counts).map(([c, n]) => /* @__PURE__ */ u3("button", {
              type: "button",
              class: "lres-chip",
              onClick: () => draft.ids[c]?.[0] && void show(c, draft.ids[c][0], false),
              children: [
                c,
                " ",
                n
              ]
            }, c, true, undefined, this))
          }, undefined, false, undefined, this),
          draft.issues.filter((i) => i.severity !== "info").slice(0, 40).map((i, n) => /* @__PURE__ */ u3("div", {
            class: `lres-issue ${i.severity}`,
            children: [
              i.severity,
              ": ",
              i.message,
              " ",
              /* @__PURE__ */ u3("span", {
                class: "lres-muted",
                children: i.path
              }, undefined, false, undefined, this)
            ]
          }, n, true, undefined, this)),
          /* @__PURE__ */ u3("div", {
            class: "lres-row",
            children: [
              /* @__PURE__ */ u3("select", {
                class: "lres-input lres-grow",
                "aria-label": "Collection",
                value: item.collection || firstItem?.[0] || "",
                onChange: (e) => setItem({ ...item, collection: e.currentTarget.value, id: "", value: null }),
                children: Object.keys(draft.ids).map((c) => /* @__PURE__ */ u3("option", {
                  value: c,
                  children: c
                }, c, false, undefined, this))
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("select", {
                class: "lres-input lres-grow",
                "aria-label": "Item",
                value: item.id,
                onChange: (e) => e.currentTarget.value && void show(item.collection || firstItem?.[0] || "", e.currentTarget.value, item.proposed),
                children: [
                  /* @__PURE__ */ u3("option", {
                    value: "",
                    children: "Item…"
                  }, undefined, false, undefined, this),
                  (draft.ids[item.collection || firstItem?.[0] || ""] ?? []).map((id) => /* @__PURE__ */ u3("option", {
                    value: id,
                    children: id
                  }, id, false, undefined, this))
                ]
              }, undefined, true, undefined, this),
              draft.review ? /* @__PURE__ */ u3("label", {
                class: "lres-muted",
                children: [
                  /* @__PURE__ */ u3("input", {
                    type: "checkbox",
                    checked: item.proposed,
                    onChange: (e) => setItem({ ...item, proposed: e.currentTarget.checked })
                  }, undefined, false, undefined, this),
                  " proposed"
                ]
              }, undefined, true, undefined, this) : null
            ]
          }, undefined, true, undefined, this),
          item.value !== null ? /* @__PURE__ */ u3("pre", {
            class: "lres-json",
            children: JSON.stringify(item.value, null, 2)
          }, undefined, false, undefined, this) : null
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ u3("div", {
        class: "lres-card",
        "data-lres-actions": true,
        children: [
          /* @__PURE__ */ u3("div", {
            class: "lres-h",
            children: "Actions"
          }, undefined, false, undefined, this),
          draft.offer ? /* @__PURE__ */ u3("div", {
            class: "lres-banner",
            children: [
              "Offered to LumiRPEngine (",
              draft.offer.mode === "new" ? "a new world" : "a new revision",
              "): review and install it in LumiRPEngine's Build tab."
            ]
          }, undefined, true, undefined, this) : null,
          /* @__PURE__ */ u3("div", {
            class: "lres-row",
            children: [
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn",
                onClick: () => void act(async () => (props.setDraft((await client.request({ type: "draft.validate", draftId: draft.id })).draft), props.notify("Checked with the engine: the problems are listed under the draft."))),
                children: "Validate"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn",
                onClick: () => void act(async () => {
                  const r = await client.request({ type: "draft.export", draftId: draft.id });
                  props.host.download(r.fileName, JSON.stringify(r.file, null, 2));
                }),
                children: "Export file"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn",
                onClick: () => fileInput.current?.click(),
                children: "Import file"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("input", {
                ref: fileInput,
                type: "file",
                accept: "application/json,.json",
                hidden: true,
                onChange: (e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (file)
                    act(async () => {
                      let parsed;
                      try {
                        parsed = JSON.parse(await file.text());
                      } catch {
                        throw new Error("That file isn't JSON.");
                      }
                      props.setDraft((await client.request({ type: "draft.import", name: "", file: parsed })).draft);
                      props.renamed();
                    });
                }
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ u3("div", {
            class: "lres-row",
            children: [
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn primary",
                disabled: props.busy || draft.running,
                onClick: () => void install("new", false),
                children: "Install as new world"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn",
                disabled: props.busy || draft.running || !props.chatId,
                onClick: () => void install("new", true),
                children: "Install and attach to this chat"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ u3("div", {
            class: "lres-row",
            children: [
              /* @__PURE__ */ u3("select", {
                class: "lres-input lres-grow",
                "aria-label": "World to revise",
                value: target,
                onFocus: () => !worlds && void act(async () => setWorlds((await client.request({ type: "pick.worlds" })).worlds)),
                onChange: (e) => setTarget(e.currentTarget.value),
                children: [
                  /* @__PURE__ */ u3("option", {
                    value: "",
                    children: draft.link ? `World ${draft.link.worldId}` : "Choose the world to revise…"
                  }, undefined, false, undefined, this),
                  (worlds ?? []).map((w) => /* @__PURE__ */ u3("option", {
                    value: w.id,
                    children: w.name
                  }, w.id, false, undefined, this))
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ u3("button", {
                type: "button",
                class: "lres-btn",
                disabled: props.busy || draft.running || !target && !draft.link,
                onClick: () => void install("revision", false),
                children: "Install as new revision"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/shared/protocol.ts
var PROTOCOL = 1;

// src/frontend/client.ts
var TIMEOUT_MS = 60000;

class Client {
  send;
  seq = 0;
  pending = new Map;
  listeners = new Set;
  off;
  constructor(send, subscribe) {
    this.send = send;
    this.off = subscribe((message) => this.receive(message));
  }
  request(body) {
    const reqId = `q${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        reject(new Error("The Studio's backend didn't answer in time."));
      }, TIMEOUT_MS);
      this.pending.set(reqId, { resolve: (value) => resolve(value), reject, timer });
      this.send({ ...body, studio: PROTOCOL, reqId });
    });
  }
  onPush(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  receive(raw) {
    if (!isRecord(raw) || raw.studio !== PROTOCOL || typeof raw.type !== "string")
      return;
    const message = raw;
    if (message.type === "result" || message.type === "error") {
      const waiting = this.pending.get(message.reqId);
      if (!waiting)
        return;
      this.pending.delete(message.reqId);
      clearTimeout(waiting.timer);
      if (message.type === "result")
        waiting.resolve(message.body);
      else
        waiting.reject(new Error(message.message));
      return;
    }
    for (const listener of this.listeners)
      listener(message);
  }
  dispose() {
    this.off();
    for (const waiting of this.pending.values())
      clearTimeout(waiting.timer);
    this.pending.clear();
    this.listeners.clear();
  }
}

// src/frontend/styles.ts
var CSS = `
.lres { display: flex; flex-direction: column; gap: 10px; padding: 10px 10px 24px; font-size: 14px; line-height: 1.4; box-sizing: border-box; }
.lres * { box-sizing: border-box; }
.lres-card { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.lres-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 600; }
.lres-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.lres-grow { flex: 1 1 160px; min-width: 0; }
.lres-muted { opacity: 0.7; font-size: 12px; }
.lres-btn { min-height: 34px; padding: 6px 12px; border-radius: 8px; border: 1px solid color-mix(in srgb, currentColor 25%, transparent); background: color-mix(in srgb, currentColor 6%, transparent); color: inherit; font: inherit; cursor: pointer; }
.lres-btn:disabled { opacity: 0.45; cursor: default; }
.lres-btn.primary { background: color-mix(in srgb, currentColor 16%, transparent); font-weight: 600; }
.lres-btn.danger { border-color: color-mix(in srgb, #d44 60%, transparent); }
.lres-input { width: 100%; min-height: 34px; padding: 6px 8px; border-radius: 8px; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); background: transparent; color: inherit; font: inherit; }
textarea.lres-input { min-height: 72px; resize: vertical; }
.lres-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.lres-chip { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: color-mix(in srgb, currentColor 10%, transparent); }
.lres-chat { display: flex; flex-direction: column; gap: 6px; max-height: 420px; overflow-y: auto; }
.lres-line { padding: 6px 8px; border-radius: 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
.lres-line.user { align-self: flex-end; background: color-mix(in srgb, currentColor 12%, transparent); max-width: 90%; }
.lres-line.assistant { background: color-mix(in srgb, currentColor 5%, transparent); }
.lres-line.tool { font-size: 12px; opacity: 0.8; padding: 2px 8px; }
.lres-line.tool.error { color: #d44; opacity: 1; }
.lres-line.note { font-size: 12px; font-style: italic; opacity: 0.75; }
.lres-issue { font-size: 12px; overflow-wrap: anywhere; }
.lres-issue.error { color: #d44; }
.lres-issue.warning { color: #c80; }
.lres-json { max-height: 320px; overflow: auto; font-family: ui-monospace, monospace; font-size: 12px; white-space: pre; padding: 8px; border-radius: 8px; background: color-mix(in srgb, currentColor 6%, transparent); }
.lres-banner { padding: 8px; border-radius: 8px; background: color-mix(in srgb, #c80 16%, transparent); font-size: 13px; }
.lres-banner.error { background: color-mix(in srgb, #d44 18%, transparent); }
`;

// src/frontend/setup.tsx
var ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9"/><path d="M16 16l5 5"/></svg>`;
function setup(ctx) {
  const cleanups = [];
  cleanups.push(ctx.dom.addStyle(CSS));
  const client = new Client((message) => ctx.sendToBackend(message), (handler) => ctx.onBackendMessage(handler));
  cleanups.push(() => client.dispose());
  const host = {
    activeChat: () => ctx.getActiveChat().chatId,
    onChatChange(listener) {
      const offs = ["CHAT_CHANGED", "CHAT_SWITCHED"].map((event) => ctx.events.on(event, listener));
      return () => offs.forEach((off) => off());
    },
    download(fileName, text) {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
  const tab = ctx.ui.registerDrawerTab({
    id: "rpengine-studio",
    title: "RPEngine Studio",
    shortName: "Studio",
    headerTitle: "RPEngine Studio",
    description: "Build LumiRPEngine worlds with an assistant, or convert this chat and its lore into one",
    keywords: ["world", "lumirpengine", "convert", "assistant", "lore"],
    iconSvg: ICON
  });
  G(/* @__PURE__ */ u3(App, {
    client,
    host
  }, undefined, false, undefined, this), tab.root);
  cleanups.push(() => {
    G(null, tab.root);
    tab.destroy();
  });
  return () => {
    for (const cleanup of cleanups.reverse()) {
      try {
        cleanup();
      } catch (error) {
        console.warn("[LumiRPEngine Studio] cleanup failed", error);
      }
    }
  };
}
export {
  setup
};
