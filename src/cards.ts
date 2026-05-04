export type Card = {
  hanzi: string;
  pinyin: string;
  ru: string;
};

/** Стартовый набор — можно дополнять. */
export const CARDS: Card[] = [
  { hanzi: "你好", pinyin: "nǐ hǎo", ru: "привет; здравствуйте" },
  { hanzi: "谢谢", pinyin: "xiè xie", ru: "спасибо" },
  { hanzi: "再见", pinyin: "zài jiàn", ru: "до свидания" },
  { hanzi: "是", pinyin: "shì", ru: "да; быть" },
  { hanzi: "不", pinyin: "bù / bú", ru: "не" },
  { hanzi: "我", pinyin: "wǒ", ru: "я" },
  { hanzi: "你", pinyin: "nǐ", ru: "ты" },
  { hanzi: "好", pinyin: "hǎo", ru: "хороший; хорошо" },
  { hanzi: "中国", pinyin: "Zhōngguó", ru: "Китай" },
  { hanzi: "学习", pinyin: "xuéxí", ru: "учиться, изучать" },
];
