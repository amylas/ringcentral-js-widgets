import Module, { state, action } from '../../lib/usm';

interface Todo {
  text: string;
}

function generate() {
  class TodoList extends Module {
    @state list: Todo[] = [{ text: 'Learn Typescript' }];

    @action
    add(todo: Todo) {
      this.list.push(todo);
    }

    async moduleDidInitialize() {
      this.add({ text: 'Learn C++' });
    }
  }

  class Index extends Module {}
  class Home extends Module {}
  class Other extends Module {}
  return {
    TodoList,
    Index,
    Home,
    Other,
  };
}

describe('usm: single module create', () => {
  test('check `create` function', () => {
    const { TodoList } = generate();
    const todoList = TodoList.create();
    expect(todoList.ready).toBeFalsy();
    setTimeout(() => {
      expect(todoList.ready).toBe(true);
    });
  });
  test('check create a instance & bootstrap', async () => {
    const { TodoList } = generate();
    const todoList = new TodoList();
    todoList.bootstrap();
    expect(todoList.ready).toBeFalsy();
    expect(todoList.list.length).toEqual(1);
    await new Promise((resolve) => setTimeout(resolve));
    expect(todoList.ready).toBe(true);
    expect(todoList.list.length).toEqual(2);
  });
});

describe('usm: parent-child set modules', () => {
  test('check `create` function', async () => {
    const { TodoList, Index } = generate();
    const todoList = new TodoList();
    const index = Index.create({
      modules: {
        todoList,
      },
    });
    expect(index.ready).toBeFalsy();
    await new Promise((resolve) => setTimeout(resolve));
    expect(todoList.ready).toBe(true);
    expect(index.ready).toBe(true);
  });
  test('check `create` function for deep sub-modules', async () => {
    class TodoList extends Module {
      @state list: Todo[] = [{ text: 'Learn Typescript' }];

      @action
      add(todo: Todo) {
        this.list.push(todo);
      }

      async moduleDidInitialize() {
        this.add({ text: 'Learn C++' });
      }
    }

    class Index extends Module<{
      todoList: TodoList;
    }> {}
    class Home extends Module {}
    class Other extends Module {}

    const todoList = new TodoList();
    const index = new Index({
      modules: {
        todoList,
      },
    });
    const other = new Other({
      modules: {
        todoList,
      },
    });
    const home = Home.create({
      modules: {
        index,
        other,
      },
    });
    expect(home.ready).toBeFalsy();
    expect(home._modules.index._modules.todoList.list.length).toEqual(1);
    await new Promise((resolve) => setTimeout(resolve));
    expect(home._modules.index._modules.todoList.list.length).toEqual(2);
    expect(todoList.ready).toBe(true);
    expect(index.ready).toBe(true);
    expect(home.ready).toBe(true);
    expect(other.ready).toBe(true);
  });

  test('check non-module', async () => {
    const { TodoList, Index } = generate();
    const todoList = new TodoList();
    const index = Index.create({
      modules: {
        todoList,
        indexOptions: { foobar: true },
      },
    });
    await new Promise((resolve) => setTimeout(resolve));
    expect(index.ready).toBe(true);
    expect(index._modules.indexOptions.foobar).toBe(true);
  });
});

describe('usm: inherit module create', () => {
  test('check base nherit module', async () => {
    const result = await new Promise((resolve) => {
      const result = [];
      class BaseFoo extends Module {
        @state
        i = 0;

        @action
        increase() {
          this.i += 1;
        }
      }

      class Foo extends BaseFoo {
        moduleDidInitialize() {
          this.increase();
          resolve(result);
        }
      }
      const foo = Foo.create() as Foo;
      Foo.create().store.subscribe(() => {
        result.push(foo.i);
      });
    });
    expect(result).toEqual([1, 2]);
  });
  test('check override `action` of inherit module', async () => {
    const result = await new Promise((resolve) => {
      const result = [];
      class BaseFoo extends Module {
        @state
        i = 0;

        @action
        increase() {
          this.i += 1;
        }
      }

      class Foo extends BaseFoo {
        @action
        increase() {
          this.i += 2;
        }

        moduleDidInitialize() {
          this.increase();
          resolve(result);
        }
      }
      const foo = Foo.create() as Foo;
      Foo.create().store.subscribe(() => {
        result.push(foo.i);
      });
    });
    expect(result).toEqual([2, 4]);
  });

  test('check override `action` & `state` of inherit module', async () => {
    const result = await new Promise((resolve) => {
      const result = [];
      class BaseFoo extends Module {
        @state
        i = 0;

        @action
        increase() {
          this.i += 1;
        }

        moduleDidInitialize() {
          this.increase();
        }
      }

      class Foo extends BaseFoo {
        @state
        i = 3;

        @action
        increase() {
          this.i += 2;
        }

        @state
        j = 10;

        @action
        decrease() {
          this.j -= 1;
        }

        moduleDidInitialize() {
          super.moduleDidInitialize();
          this.decrease();
          resolve(result);
        }
      }
      const foo = Foo.create() as Foo;
      Foo.create().store.subscribe(() => {
        result.push([foo.i, foo.j]);
      });
    });
    expect(result).toEqual([
      [5, 10],
      [5, 9],
      [7, 9],
      [7, 8],
    ]);
  });
});
