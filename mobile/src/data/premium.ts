// 유료 기능 권한. 로그인한 계정의 유료 권한(member), 개발 빌드 전용 미리보기, 개인 접근 코드 중 하나로 연다.
// 수첩 백업 형식과 섞이지 않도록 별도 app_settings 표에 저장한다. member는 저장하지 않는다.
export interface PremiumSettings {
  preview: boolean;
  accessCode: string;
  member?: { token: string; premium: boolean };
}

export const noPremium: PremiumSettings = { preview: false, accessCode: "" };

/** 이 빌드에서 열어 둔 유료 기능. */
export interface PaidBuild {
  /** 유료 기능 입구를 보일지. */
  paid: boolean;
  /** 시험용 도구(유료 미리보기, 접근 코드 입력)를 보일지. */
  testTools: boolean;
}

// 인앱 결제를 붙이기 전의 출시 빌드에는 유료 기능을 넣지 않는다. 살 수 없는 기능을 보이거나
// 접근 코드로 여는 것은 App Store 심사 기준 2.1·2.3.1·3.1.1에 걸린다.
// 개발 빌드와 EXPO_PUBLIC_PAID_PREVIEW=1로 만든 내부 시험 빌드에서만 연다. 값이 비었거나 "1"이 아니면 꺼진다.
// 스토어 제출용(EAS production) 빌드에 1을 넣으면 app.config.js가 빌드를 멈춘다.
// 인앱 결제를 붙이면 paid는 출시 빌드에서도 켜고, testTools는 계속 시험 빌드에만 둔다.
export function paidBuildFor(dev: boolean, previewFlag: string | undefined): PaidBuild {
  const open = dev || previewFlag?.trim() === "1";
  return { paid: open, testTools: open };
}

export const paidBuild: PaidBuild = paidBuildFor(typeof __DEV__ !== "undefined" && __DEV__, process.env.EXPO_PUBLIC_PAID_PREVIEW);

export function hasPremium(settings: PremiumSettings, build: PaidBuild = paidBuild): boolean {
  if (!build.paid) return false;
  return (build.testTools && settings.preview) || !!settings.member?.premium;
}

/** 서버에 보낼 인증 값. 로그인했으면 로그인 토큰, 아니면 입력한 접근 코드(시험 빌드만). */
export function premiumCredential(settings: PremiumSettings, typedCode: string, build: PaidBuild = paidBuild): string {
  return settings.member?.token ?? (build.testTools ? typedCode.trim() : "");
}

export function parsePremium(raw: string | null): PremiumSettings {
  if (raw === null) return noPremium;
  try {
    const value = JSON.parse(raw);
    return {
      preview: value?.preview === true,
      accessCode:
        typeof value?.accessCode === "string" ? value.accessCode.slice(0, 200) : "",
    };
  } catch {
    return noPremium;
  }
}

export interface SettingsDriver {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
}

const KEY = "premium";

export function createPremiumStore(driver: SettingsDriver) {
  return {
    async load() {
      return parsePremium(await driver.read(KEY));
    },
    async save(settings: PremiumSettings) {
      await driver.write(KEY, JSON.stringify({ preview: settings.preview, accessCode: settings.accessCode }));
    },
  };
}
