import {
  autorun,
  title,
  Scenario,
  Given,
  When,
  Then,
  Step,
  examples,
} from '@ringcentral-integration/test-utils';

import { RcModuleV2, state, action, computed } from '../../lib';

const generateModule = (
  numberComputedFn: Function,
  listCountComputedFn: Function,
  sumComputedFn: Function,
) => {
  class Foo extends RcModuleV2 {
    @state
    count = 0;

    @state
    list = ['test'];

    @action
    add() {
      this.list.push('text');
    }

    @action
    change() {
      this.list[0] = 'bar';
    }

    @action
    increase() {
      this.count += 1;
    }

    @computed((that: Foo) => [that.count])
    get number() {
      numberComputedFn();
      return this.count + 1;
    }

    @computed((that: Foo) => [that.list])
    get listCount() {
      listCountComputedFn();
      return this.list.length;
    }

    @computed((that: Foo) => [that.count, that.list.length])
    get sum() {
      sumComputedFn();
      return this.count + this.list.length;
    }
  }
  return Foo;
};

@autorun(test)
@title('RcModuleV2::computed check with "${executeFunction}"')
class ModuleComputedCheck extends Step {
  @examples(`
    | executeFunction | numberComputed      | listCountComputed     | sumComputed         |
    | 'add'           | {time: 1, value: 1} | {time: 2, value: 2}   | {time: 2, value: 2} |
    | 'change'        | {time: 1, value: 1} | {time: 2, value: 1}   | {time: 1, value: 1} |
    | 'increase'      | {time: 2, value: 2} | {time: 1, value: 1}   | {time: 2, value: 2} |
  `)
  run() {
    return (
      <Scenario desc="RcModuleV2::computed check features">
        <Given
          desc="Generic RcModuleV2 instance fooInstance of class Foo"
          action={(_: any, context: any) => {
            context.numberComputedFn = jest.fn();
            context.listCountComputedFn = jest.fn();
            context.sumComputedFn = jest.fn();
            context.Foo = generateModule(
              context.numberComputedFn,
              context.listCountComputedFn,
              context.sumComputedFn,
            );
            context.fooInstance = context.Foo.create();
            expect(context.fooInstance instanceof context.Foo).toBe(true);
          }}
        />
        <When
          desc="fooInstance run '${executeFunction}'"
          action={(_: any, context: any) => {
            const {
              fooInstance,
              numberComputedFn,
              listCountComputedFn,
              sumComputedFn,
              example: { executeFunction },
            } = context;
            expect(fooInstance.number).toBe(1);
            expect(fooInstance.sum).toBe(1);
            expect(fooInstance.listCount).toBe(1);
            expect(listCountComputedFn.mock.calls.length).toBe(1);
            expect(sumComputedFn.mock.calls.length).toBe(1);
            expect(numberComputedFn.mock.calls.length).toBe(1);
            fooInstance[executeFunction]();
          }}
        />
        <Then
          desc="fooInstance should be computed numberComputed: ${numberComputed}, listCountComputed: ${listCountComputed}, and sumComputed:${sumComputed}"
          action={(_: any, context: any) => {
            const {
              fooInstance,
              numberComputedFn,
              listCountComputedFn,
              sumComputedFn,
              example: { numberComputed, listCountComputed, sumComputed },
            } = context;
            expect(fooInstance.listCount).toBe(listCountComputed.value);
            expect(fooInstance.sum).toBe(sumComputed.value);
            expect(fooInstance.number).toBe(numberComputed.value);
            expect(numberComputedFn.mock.calls.length).toBe(
              numberComputed.time,
            );
            expect(listCountComputedFn.mock.calls.length).toBe(
              listCountComputed.time,
            );
            expect(sumComputedFn.mock.calls.length).toBe(sumComputed.time);
          }}
        />
      </Scenario>
    );
  }
}

@autorun(test)
@title('RcModuleV2::computed check with inheritance')
class ModuleComputedCheckWithInheritance extends Step {
  run() {
    return (
      <Scenario desc="RcModuleV2::computed check features">
        <Given
          desc="Generic RcModuleV2 instance barInstance of class Bar"
          action={(_: any, context: any) => {
            class BaseFoo<T = any> extends RcModuleV2<T> {
              computedFn = jest.fn();

              @state
              count = 0;

              @action
              increase() {
                this.count += 1;
              }

              @computed(({ count }: BaseFoo) => [count])
              get num() {
                this.computedFn();
                return this.count + 1;
              }
            }
            class Foo extends BaseFoo {}

            class Bar extends RcModuleV2<{ baseFoo: BaseFoo; foo: Foo }> {
              get baseFoo() {
                return this._deps.baseFoo;
              }

              get foo() {
                return this._deps.foo;
              }
            }
            const baseFoo = new BaseFoo({ deps: {} });
            const foo = new Foo({ deps: {} });
            context.barInstance = Bar.create({ deps: { baseFoo, foo } } as any);
            expect(context.barInstance instanceof Bar).toBe(true);
          }}
        />
        <When
          desc="barInstance run computed and check value"
          action={(_: any, context: any) => {
            const { barInstance } = context;
            expect(barInstance.foo.num).toBe(1);
            expect(barInstance.baseFoo.num).toBe(1);
          }}
        />
        <Then
          desc="barInstance should be computed expected times"
          action={(_: any, context: any) => {
            const { barInstance } = context;
            expect(barInstance.foo.computedFn.mock.calls.length).toBe(1);
            expect(barInstance.baseFoo.computedFn.mock.calls.length).toBe(1);
            expect(barInstance.foo.num).toBe(1);
            expect(barInstance.baseFoo.num).toBe(1);
            expect(barInstance.foo.computedFn.mock.calls.length).toBe(1);
            expect(barInstance.baseFoo.computedFn.mock.calls.length).toBe(1);
          }}
        />
        <When
          desc="barInstance run 'foo.increase'"
          action={(_: any, context: any) => {
            const { barInstance } = context;
            barInstance.foo.increase();
          }}
        />
        <Then
          desc="Only barInstance 'foo.num' should be increased 1 computed times"
          action={(_: any, context: any) => {
            const { barInstance } = context;
            expect(barInstance.foo.num).toBe(2);
            expect(barInstance.baseFoo.num).toBe(1);
            expect(barInstance.foo.computedFn.mock.calls.length).toBe(2);
            expect(barInstance.baseFoo.computedFn.mock.calls.length).toBe(1);
          }}
        />
        <When
          desc="barInstance run 'foo.increase'"
          action={(_: any, context: any) => {
            const { barInstance } = context;
            barInstance.foo.increase();
          }}
        />
        <When
          desc="Only barInstance 'foo.num' should be increased 1 computed times"
          action={(_: any, context: any) => {
            const { barInstance } = context;
            expect(barInstance.foo.num).toBe(3);
            expect(barInstance.foo.num).toBe(3);
            expect(barInstance.baseFoo.num).toBe(1);
            expect(barInstance.baseFoo.num).toBe(1);
            expect(barInstance.foo.num).toBe(3);
            expect(barInstance.foo.computedFn.mock.calls.length).toBe(3);
            expect(barInstance.baseFoo.computedFn.mock.calls.length).toBe(1);
          }}
        />
        <When
          desc="barInstance run 'baseFoo.increase'"
          action={(_: any, context: any) => {
            const { barInstance } = context;
            barInstance.baseFoo.increase();
          }}
        />
        <Then
          desc="Only barInstance 'baseFoo.num' should be increased 1 computed times"
          action={(_: any, context: any) => {
            const { barInstance } = context;
            expect(barInstance.foo.num).toBe(3);
            expect(barInstance.baseFoo.num).toBe(2);
            expect(barInstance.foo.computedFn.mock.calls.length).toBe(3);
            expect(barInstance.baseFoo.computedFn.mock.calls.length).toBe(2);
            expect(barInstance.foo.num).toBe(3);
            expect(barInstance.baseFoo.num).toBe(2);
            expect(barInstance.foo.computedFn.mock.calls.length).toBe(3);
            expect(barInstance.baseFoo.computedFn.mock.calls.length).toBe(2);
          }}
        />
      </Scenario>
    );
  }
}
