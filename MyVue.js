

function defineReactive(obj, key, val) {
    // 递归处理,给对象深层次拦截
    observe(val)
    // 创建Dep实例
    const dep = new Dep()
    Object.defineProperty(obj, key, {
        get() {
            console.log('get ', key)
            // 判断一下Dep.target是否存在，若存在进行依赖收集
            // 这里的Dep.target其实就是watcher
            Dep.target && dep.addDep(Dep.target);
            return val
        },

        set(v) {
            if (v !== val) {
                console.log('set', key, v)
                val = v
            }
            // 检测到值变化通知对应的dep更新
            dep.notify()
        }
    })
}

// 对象响应式，对其执行defineReactive
function observe(obj) {
    // 首先判断obj是否是对象,忽略我的有问题的写法😂
    if (typeof obj !== 'object' || obj === null) {
        return
    }
    new Observer(obj) // 观察者
}

class Observer {
    constructor(obj) {
        this.value = obj

        if (Array.isArray(obj)) {
            // todo 数组的重写7个方法暂不处理 push/shift/pop/unshift...
        } else {
            this.walk(obj)
        }
    }


    // 给对象加上拦截实现响应式
    walk(obj) {
        Object.keys(obj).forEach(key => {
            defineReactive(obj, key, obj[key])
        })
    }
}

// 把data的key代理到vm上，我们可以直接写this.xxx而不必写this.data.xxx
// 异常处理忽略--比如vm已经有了某个$data[key],我们不能覆盖处理
function proxy(vm) {
    Object.keys(vm.$data).forEach(key => {
        Object.defineProperty(vm, key, {
            get() {
                return vm.$data[key];
            },
            set(newVal) {
                vm.$data[key] = newVal;
            }
        });
    })
}

// Vue主入口
class KVue {

    constructor(options) {
        // 1.响应式
        this.$options = options
        // 把数据绑定到$data
        this.$data = options.data
        observe(this.$data)

        // 代理- 把vm传给proxy方法做处理
        proxy(this)

        // 2.compile编译
        // 就是把{{}} v-xx这些变量、指令编译成对应的值和绑定上对应的方法
        new Compile(options.el, this)
    }
}

// 编译
class Compile {
    constructor(el, vm) {
        this.$vm = vm;
        this.$el = document.querySelector(el);
        // 遍历el
        if (this.$el) {
            this.compile(this.$el);
        }
    }

    compile(el) {
        const childNodes = el.childNodes;
        // childNodes是伪数组
        Array.from(childNodes).forEach(node => {
            if (this.isElement(node)) {
                console.log("编译元素" + node.nodeName);
                this.compileElement(node)
            } else if (this.isInterpolation(node)) {
                console.log("编译插值⽂本" + node.textContent);
                this.compileText(node);
            }
            if (node.childNodes && node.childNodes.length > 0) {
                this.compile(node);
            }
        });
    }

    // 元素
    isElement(node) {
        return node.nodeType == 1;
    }

    // 是否是{{}}插值表达式
    isInterpolation(node) {
        return node.nodeType == 3 && /\{\{(.*)\}\}/.test(node.textContent);
    }

    // 使用RegExp.$1拿到{{xxx}}中的插值属性 xxx
    compileText(node) {
        console.log(RegExp.$1);
        // node.textContent = this.$vm[RegExp.$1];
        this.update(node, RegExp.$1, 'text')
    }

    // 获取指令表达式 v-xxx
    isDirective(attr) {
        return attr.indexOf("v-") == 0;
    }

    // 编译元素
    compileElement(node) {
        let nodeAttrs = node.attributes;
        // 编译元素上属性 v-if v-xxx
        Array.from(nodeAttrs).forEach(attr => {
            let attrName = attr.name;
            let exp = attr.value;
            if (this.isDirective(attrName)) {
                let dir = attrName.substring(2);
                this[dir] && this[dir](node, exp);
            }
        });
    }

    // v-text
    text(node, exp) {
        this.update(node, exp, 'text')
    }

    // v-html
    html(node, exp) {
        this.update(node, exp, 'html')
    }

    // 统一处理 指令v-
    // dir: text  exp: {{xxx}}中的xxx node: 使用指令的元素节点
    update(node, exp, dir) {
        const fn = this[dir + 'Updater']
        fn && fn(node, this.$vm[exp])
        // 触发视图更新
        new Watcher(this.$vm, exp, function (val) {
            fn && fn(node, val)
        })
    }

    // 处理v-text的节点赋值
    textUpdater(node, val) {
        node.textContent = val;
    }
    // 处理v-html的节点赋值
    htmlUpdater(node, val) {
        node.innerHTML = val
    }
}

// dep 用于依赖收集 主要监听data中属性 一个属性对应一个dep负责监听变化并通过watcher观察者进行更新
class Dep {
    constructor() {
        this.deps = []
    }
    addDep(dep) {
        this.deps.push(dep)
    }
    notify() {
        this.deps.forEach(dep => dep.update());
    }
}

// 创建watcher时触发getter并进行依赖收集
class Watcher {
    constructor(vm, key, updateFn) {
        this.vm = vm;
        // 依赖key
        this.key = key;
        // 更新函数
        this.updateFn = updateFn;

        // 获取一下key的值触发get，并创建当前watcher实例和dep的映射关系
        Dep.target = this;
        // 这一步的目的是初始化取值触发getter 
        this.vm[this.key];
        Dep.target = null;
    }

    // 更新
    update() {
        this.updateFn.call(this.vm, this.vm[this.key]);
    }
}