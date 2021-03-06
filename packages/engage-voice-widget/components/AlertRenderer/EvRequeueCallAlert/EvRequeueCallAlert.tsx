import { contains } from 'ramda';
import i18n from './i18n';
import { requeueEvents } from '../../../enums';

interface EvRequeueCallAlertProps {
  message: {
    message: string;
  };
  currentLocale: string;
}

export default function EvRequeueCallAlert({
  message: { message },
  currentLocale,
}: EvRequeueCallAlertProps) {
  return i18n.getString(message, currentLocale);
}

EvRequeueCallAlert.handleMessage = ({ message }: { message: string }) =>
  contains(message, [
    requeueEvents.FAILURE,
    requeueEvents.START,
    requeueEvents.SUCCESS,
  ]);
