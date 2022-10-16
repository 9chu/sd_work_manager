import assert from 'assert';


export interface IntrusiveHeapNode {
  left: IntrusiveHeapNode | null;
  right: IntrusiveHeapNode | null;
  parent: IntrusiveHeapNode | null;
}

export class IntrusiveHeap<T extends IntrusiveHeapNode> {
  #less: (a: T, b: T) => boolean;
  #min: T | null = null;
  #nelts = 0;

  constructor(less: (a: T, b: T) => boolean) {
    this.#less = less;
  }

  private nodeSwap(parent: IntrusiveHeapNode, child: IntrusiveHeapNode): void {
    const tLeft = parent.left;
    const tRight = parent.right;
    const tParent = parent.parent;
    parent.left = child.left;
    parent.right = child.right;
    parent.parent = child.parent;
    child.left = tLeft;
    child.right = tRight;
    child.parent = tParent;

    let sibling = null;
    parent.parent = child;
    if (child.left === child) {
      child.left = parent;
      sibling = child.right;
    } else {
      child.right = parent;
      sibling = child.left;
    }

    if (sibling !== null)
      sibling.parent = child;

    if (parent.left !== null)
      parent.left.parent = parent;

    if (parent.right !== null)
      parent.right.parent = parent;

    if (child.parent === null)
      this.#min = child as T;
    else if (child.parent.left === parent)
      child.parent.left = child;
    else
      child.parent.right = child;
  }

  top(): T | null {
    return this.#min;
  }

  empty(): boolean {
    return this.#min === null;
  }

  insert(node: T): void {
    node.left = null;
    node.right = null;
    node.parent = null;

    // 计算从栈顶到插入点的路径
    // 由于是最小堆，我们总是取最左边的空闲节点插入
    let path = 0;
    let k = 0;
    let n = 1 + this.#nelts;
    while (n >= 2) {
      path = (path << 1) | (n & 1);
      k = k + 1;
      n = Math.floor(n / 2);
    }

    // 使用构造的路径遍历堆
    // parent = child = &heap->min
    let parent: IntrusiveHeapNode | null = null;
    let parentRef: 'min' | 'left' | 'right' = 'min';
    let child: IntrusiveHeapNode | null = null;
    let childRef: 'min' | 'left' | 'right' = 'min';
    while (k > 0) {
      // parent = child
      parent = child;
      parentRef = childRef;

      if (childRef === 'min') {
        assert(child === null);
        child = this.#min;
      } else {
        assert(child !== null);
        child = child[childRef];
      }

      if ((path & 1) !== 0) {
        // child = &(*child)->right
        childRef = 'right';
      } else {
        // child = &(*child)->left
        childRef = 'left';
      }
      path = path >> 1;
      k = k - 1;
    }

    // 插入新节点
    // newnode->parent = *parent
    if (parentRef === 'min') {
      assert(parent === null);
      node.parent = this.#min;
    } else {
      assert(parent !== null);
      node.parent = parent[parentRef]
    }
    if (childRef === 'min') {
      assert(child === null);
      this.#min = node;
    } else {
      assert(child !== null);
      child[childRef] = node;
    }
    this.#nelts = this.#nelts + 1;

    // 重新构造Heap
    while (node.parent && this.#less(node, node.parent as T))
      this.nodeSwap(node.parent, node);
  }

  remove(node: T): void {
    if (this.#nelts === 0)
      return;
    assert(node !== null);

    // 计算从栈顶到插入点的路径
    // 由于是最小堆，我们总是取最左边的空闲节点插入
    let path = 0;
    let k = 0;
    let n = this.#nelts;
    while (n >= 2) {
      path = (path << 1) | (n & 1);
      k = k + 1;
      n = Math.floor(n / 2);
    }

    // 使用构造的路径遍历堆
    // max = &heap->min
    let max: IntrusiveHeapNode | null = null;
    let maxRef: 'min' | 'left' | 'right' = 'min';
    while (k > 0) {
      if (maxRef === 'min') {
        assert(max === null);
        max = this.#min;
      } else {
        assert(max !== null);
        max = max[maxRef];
      }

      if ((path & 1) !== 0) {
        // max = &(*max)->right
        maxRef = 'right';
      } else {
        // max = &(*max)->left
        maxRef = 'left';
      }

      path = path >> 1;
      k = k - 1;
    }

    this.#nelts = this.#nelts - 1;

    // 断开最大元素
    let child: IntrusiveHeapNode | null;
    if (maxRef === 'min') {
      child = this.#min;
      this.#min = null;
    } else {
      assert(max !== null);
      child = max[maxRef];
      max[maxRef] = null;
    }

    if (child === node) {
      // 我们正在移除堆中的最大元素或者是最后一个元素
      if (child === this.#min)
        this.#min = null;
      return;
    }

    // 用最大元素去置换要被删除的元素
    assert(child !== null);
    child.left = node.left;
    child.right = node.right;
    child.parent = node.parent;

    if (child.left !== null)
      child.left.parent = child;

    if (child.right !== null)
      child.right.parent = child;

    if (node.parent === null)
      this.#min = child as T;
    else if (node.parent.left === node)
      node.parent.left = child;
    else
      node.parent.right = child;

    // 遍历子树，检查每一个元素是否置于正确的位置
    // 因为是最小堆，所以必然有 parent < child，如果出现反例，需要交换元素来保持最小堆
    let smallest;
    for (;;) {
      smallest = child;
      if (child.left && this.#less(child.left as T, smallest as T))
        smallest = child.left;
      if (child.right && this.#less(child.right as T, smallest as T))
        smallest = child.right;
      if (smallest === child)
        break;

      this.nodeSwap(child, smallest);
    }

    // 向上遍历子树并检查堆的条件是否成立
    // 因为`max`节点不一定是堆中实际最大的元素
    while (child.parent && this.#less(child as T, child.parent as T))
      this.nodeSwap(child.parent, child);
  }

  dequeue(): T | null {
    if (this.#min === null)
      return null;
    const min = this.#min;
    this.remove(this.#min);
    return min;
  }

  forEach(callback: (node: T) => void): void {
    if (this.#min === null)
      return;
    this.visit(this.#min, callback);
  }

  private visit(node: IntrusiveHeapNode, callback: (e: T) => void) {
    callback(node as T);
    if (node.left)
      this.visit(node.left, callback);
    if (node.right)
      this.visit(node.right, callback);
  }
}
