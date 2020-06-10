import { CleaningProcess } from '../../vo/cleaning/CleaningInstructionsVO';

class HqlHelper {
  // @ts-ignore
  selfMatch: string = '';
  // @ts-ignore
  replaceSql: string = '';

  static DATE_FORMAT_TYPE: Map<string, any> = new Map([
    ['YYYY/MM/DD', ['%Y/%m/%d', 'yyyy/MM/dd', '^\\d{4}/\\d{1,2}/\\d{1,2}$', '^\\d{4}/\\d{1,2}/\\d{1,2}$']],
    ['YYYY-MM-DD', ['%Y-%m-%d', 'yyyy-MM-dd', '^\\d{4}-\\d{1,2}-\\d{1,2}$', '^\\d{4}-\\d{1,2}-\\d{1,2}$']]
  ]);

  constructor(process: CleaningProcess, allColumn: string, dbtype: number) {
    if (process.processCode === CLEANING_CODE.CLEANING_VALUE_FIXED) {
      // 任意の値設定
      this.selfMatch = '1=1';
      this.replaceSql = `${process.param1}`;
    } else if (process.processCode === CLEANING_CODE.CLEANING_VALUE_AVERAGE) {
      // 平均値設定
      this.selfMatch = '1=1';
      this.replaceSql = `${process.columnName}_avg`;
    } else if (process.processCode === CLEANING_CODE.CLEANING_VALUE_EXPRESS) {
      // 他のカラムからの計算結果
      this.selfMatch = '1=1';
      this.replaceSql = `${process.param1}`;
    } else if (process.processCode === CLEANING_CODE.CLEANING_STRING_CASE) {
      // 大文字小文字の表記の統一
      if (process.param1 === CLEANING_SUB_TYPE.STRING_CAPITALIZE_UPPER) {
        // 小 => 大
        this.selfMatch = `regexp_like(${process.columnExpress},'[a-z]')`;
        this.replaceSql = `upper(${process.columnExpress})`;
        if (dbtype === HQL_TYPE.HIVE) {
          this.selfMatch = `${process.columnExpress} regexp [a-z])`;
        }
      } else {
        // 大 => 小
        this.selfMatch = `regexp_like(${process.columnExpress},'[A-Z]')`;
        if (dbtype === HQL_TYPE.HIVE) {
          this.selfMatch = `${process.columnExpress} regexp [A-Z])`;
        }
        this.replaceSql = `lower(${process.columnExpress})`;
      }
    } else if (process.processCode === CLEANING_CODE.CLEANING_STRING_CAPITALIZE) {
      // 先頭文字が大文字で表示
      this.selfMatch = `regexp_like(${process.columnExpress},'^[a-z]') `;
      this.replaceSql = `regexp_replace(${process.columnExpress},'^([a-z]{1})(.*)',x -> upper(x[1]) || x[2])`;
      if (dbtype === HQL_TYPE.HIVE) {
        this.selfMatch = `${process.columnExpress} regexp '^[a-z]+') `;
        this.replaceSql = `initcap(${process.columnExpress})`;
      }
    } else if (process.processCode === CLEANING_CODE.CLEANING_STRING_TRIM) {
      // 前後のスペースを削除
      this.selfMatch = `regexp_like(${process.columnExpress},'^\\s') or regexp_like(${process.columnExpress},'\\s$')`;
      this.replaceSql = `trim(${process.columnExpress})`;
      if (dbtype === HQL_TYPE.HIVE) {
        this.selfMatch = `(${process.columnExpress} regexp '^\\s') or (${process.columnExpress} regexp '\\s$') `;
        this.replaceSql = `trim(${process.columnExpress})`;
      }
    } else if (process.processCode === CLEANING_CODE.CLEANING_STRING_MASK) {
      // データのマスク
      if (process.param1 === CLEANING_SUB_TYPE.STRING_MASK_ALL) {
        // 全て
        this.selfMatch = `length(${process.columnExpress}) > 0`;
        this.replaceSql = `lpad('*',length(${process.columnExpress}),'*')`;
      } else {
        //
        this.selfMatch = `regexp_like(${process.columnExpress},'${process.param2}')`;
        this.replaceSql = `regexp_replace(${process.columnExpress},'(${process.param2})', x -> lpad('*',length(x[1]),'*'))`;
        if (dbtype === HQL_TYPE.HIVE) {
          this.selfMatch = `${process.columnExpress} regexp '${process.param2}') `;
          this.replaceSql = `regexp_replace(${process.columnExpress},'(${process.param2})', '*****')`;
        }
      }
    } else if (process.processCode === CLEANING_CODE.CLEANING_DATE_FORMAT) {
      // 日付形式の変更
      const fmt_to: string = HqlHelper.DATE_FORMAT_TYPE.get(process.param1)[dbtype];
      const fmt_from: string = HqlHelper.DATE_FORMAT_TYPE.get(process.param2)[dbtype];
      const match: string = HqlHelper.DATE_FORMAT_TYPE.get(process.param2)[dbtype + 2];
      this.selfMatch = `regexp_like(${process.columnExpress},'${match}')`;
      this.replaceSql = `date_format(date_parse(${process.columnExpress},'${fmt_from}'),'${fmt_to}')`;
      if (dbtype === HQL_TYPE.HIVE) {
        this.selfMatch = `${process.columnExpress} regexp '${match}'`;
        this.replaceSql = `from_unixtime(unix_timestamp(${process.columnExpress},'${fmt_from}'),'${fmt_to}')`;
      }
    } else if (process.processCode === CLEANING_CODE.CLEANING_NUMBER_FORMAT) {
      //  カンマ区切り
      this.selfMatch = `regexp_like(${process.columnExpress},'^-?[0-9]{4}+\\.?[0-9]*$')`;
      // this.replaceSql = `array_join(regexp_split(cast(${process.columnExpress} as varchar(50)),'\\B(?=(\\d{3})+(?!\\d))'),',')`;
      this.replaceSql = `concat(regexp_replace(split_part(cast(${process.columnExpress} as varchar(50)),'.',1) ,'\\B(?=(\\d{3})+(?!\\d))',','),if(strpos(cast(${process.columnExpress} as varchar(50)),'.') > 0 ,concat('.',split_part(cast(${process.columnExpress} as varchar(50)),'.',2)), ''))`;
      if (dbtype === HQL_TYPE.HIVE) {
        this.replaceSql = `format_number(${process.columnExpress}, 2)`;
      }
    } else if (process.processCode === CLEANING_CODE.CLEANING_NUMBER_MINUS) {
      // マイナス値の表記方法
      this.selfMatch = `regexp_like(${process.columnExpress},'^-')`;
      if (process.param1 === '0') {
        this.replaceSql = `${process.columnExpress}`;
      } else if (process.param1 === '1') {
        this.replaceSql = `concat('(',replace(${process.columnExpress},'-',''),')')`;
      } else {
        this.replaceSql = `replace(${process.columnExpress}, '-', 'Δ')`;
      }
    } else if (process.processCode === CLEANING_CODE.CLEANING_NUMBER_PRECISION) {
      // 小数点以下の桁数
      this.selfMatch = `regexp_like(${process.columnExpress},'\\.[0-9]{${parseInt(process.param1, 10) + 1}}')`;
      this.replaceSql = `cast(round(cast(${process.columnExpress} as double), ${process.param1}) as varchar)`;
      if (dbtype === HQL_TYPE.HIVE) {
        this.selfMatch = `${process.columnExpress} regexp '\\.[0-9]{${process.param1 + 1}}')`;
      }
    } else if (process.processCode === CLEANING_CODE.CLEANING_NUMBER_UNIT) {
      // 単位表記
      this.selfMatch = `regexp_like(${process.columnExpress},'^-?\\d+.?\\d*')`;
      this.replaceSql = `concat(cast(cast(${process.columnExpress} as double)/${process.param1} as varchar), '${process.param2}')`;
    } else if (process.processCode === CLEANING_CODE.CLEANING_ROWS_DISTINCT) {
      // 重複行削除
      this.selfMatch = 'duplicated_flg = 1';
      this.replaceSql = '';
    } else if (process.processCode === CLEANING_CODE.CLEANING_ROWS_DELETE) {
      // 特定の値の行の削除
      this.selfMatch = `${process.param1}`;
      this.replaceSql = '1';
    } else {
      throw new Error(`processCode ${process.processCode} undefined!`);
    }
  }
}

export enum HQL_TYPE {
  PRESTO = 0,
  HIVE = 1
}

export enum CLEANING_CODE {
  CLEANING_VALUE_FIXED = '101',
  CLEANING_VALUE_AVERAGE = '102',
  CLEANING_VALUE_EXPRESS = '103',
  CLEANING_STRING_CASE = '111',
  CLEANING_STRING_CAPITALIZE = '112',
  CLEANING_STRING_TRIM = '115',
  CLEANING_STRING_MASK = '121',
  CLEANING_DATE_FORMAT = '131',
  CLEANING_NUMBER_FORMAT = '141',
  CLEANING_NUMBER_MINUS = '142',
  CLEANING_NUMBER_PRECISION = '143',
  CLEANING_NUMBER_UNIT = '144',
  CLEANING_ROWS_DISTINCT = '201',
  CLEANING_ROWS_DELETE = '202'
}

export enum CLEANING_SUB_TYPE {
  STRING_CAPITALIZE_UPPER = '0',
  STRING_CAPITALIZE_LOWER = '1',
  STRING_MASK_ALL = '0',
  STRING_MASK_MATCH = '1'
}

Object.seal(HqlHelper);
export default HqlHelper;
