import {
  BaseStep,
  StepFunction as BaseStepFunction,
} from '@ringcentral-integration/test-utils';
import { Context } from '../interfaces';

export {
  Scenario,
  Given,
  When,
  Then,
  And,
  autorun,
  title,
  examples,
  beforeEach,
} from '@ringcentral-integration/test-utils';

export interface StepFunction<P = {}, C = {}>
  extends BaseStepFunction<P, C & Context> {}

export class Step<P = {}, C = {}> extends BaseStep<P, C & Context> {
  static context: Context = {
    get phone() {
      return global.instance.phone;
    },
    payload: {
      //
    },
  };
}
