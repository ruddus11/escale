import { translate, type Key } from "./strings";

/** 화면에 보일 오류. 화면은 key를 지금 언어로 번역하고, message에는 한국어 문장을 둔다(기록·테스트용). */
export class KeyedError extends Error {
  constructor(readonly key: Key) {
    super(translate("ko", key));
  }
}
