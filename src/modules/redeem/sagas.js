// NPM Dependencies
import { fork, takeLatest, put, call, race, take } from 'redux-saga/effects';
import { delay } from 'redux-saga';

// Local Dependencies
import { getGiftDetails, redeemGift, getRedeemStatus } from './services';
import {
    getGiftDetailsSignal,
    redeemGiftSignal,
    replaceGiftDetails,
    startCheckRedeemStatusSignal,
    stopCheckRedeemStatusSignal,
    replaceRedeemStatus
} from './actions';

export function* getGiftDetailsOnRequest({ payload }) {
    try {
        const { orderId } = payload;

        const giftDetails = yield call(getGiftDetails, orderId);

        yield put(replaceGiftDetails(giftDetails));

        yield put(getGiftDetailsSignal.success(giftDetails));
    } catch (error) {
        yield put(replaceGiftDetails('notFound'));

        yield put(getGiftDetailsSignal.failure({ error }));
    }
}

export function* watchGetGiftDetailsSignal() {
    yield takeLatest(
        getGiftDetailsSignal.REQUEST,
        getGiftDetailsOnRequest
    );
}

export function* redeemGiftOnRequest({ payload }) {
    try {
        const { orderId, invoice } = payload;

        const redeemGiftRequest = yield call(redeemGift, { orderId, invoice });

        const { withdrawalId } = redeemGiftRequest;

        yield put(redeemGiftSignal.success(redeemGiftRequest));

        yield put(startCheckRedeemStatusSignal.request({ withdrawalId, orderId }));
    } catch (error) {
        yield put(redeemGiftSignal.failure({ error }));
    }
}

export function* watchRedeemGiftDetailsSignal() {
    yield takeLatest(
        redeemGiftSignal.REQUEST,
        redeemGiftOnRequest
    );
}

export function* startCheckRedeemStatusOnRequest({ payload }) {
    while (true) {
        const { withdrawalId, orderId } = payload;

        try {
            const redeemStatus = yield call(getRedeemStatus, { withdrawalId, orderId });

            yield put(replaceRedeemStatus(redeemStatus));

            if (redeemStatus.status === 'confirmed') {
                yield put(getGiftDetailsSignal.request({ orderId }));
                yield put(stopCheckRedeemStatusSignal.request());
            }

            yield call(delay, 5000);
        } catch (error) {
            yield put(startCheckRedeemStatusSignal.failure({ error }));

            yield put(replaceRedeemStatus({ error: 'fail' }));

            yield put(stopCheckRedeemStatusSignal.request());

            // yield call(delay, 15000);
        }
    }
}

export function* watchStartCheckRedeemStatusSignal() {
    while (true) {
        const payload = yield take(startCheckRedeemStatusSignal.REQUEST);

        yield race([
            call(startCheckRedeemStatusOnRequest, payload),
            take(stopCheckRedeemStatusSignal.REQUEST)
        ]);
    }
}

export default [
    fork(watchRedeemGiftDetailsSignal),
    fork(watchGetGiftDetailsSignal),
    fork(watchStartCheckRedeemStatusSignal)
];
