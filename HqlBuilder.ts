import { plainToClass } from 'class-transformer';
import { CleaningInstruction, CleaningProcess, CleaningMatch } from '../../vo/cleaning/CleaningInstructionsVO';
import { CleaningJobDetailVO } from '../../vo/cleaning/CleaningJobDetailVO';
import HqlHelper, { CLEANING_CODE, HQL_TYPE } from './HqlHelper';

class HqlBuilder {
  // parameter
  private columns: string[] = [];
  private targetTableName: string = '';
  private strAllColumns: string = '';

  // sql clause
  private sqlSelect: string = '';
  private sqlFromClause: string = '';
  private sqlMartchedWhere: string = '';
  private sqlModifiedWhere: string = '';
  private sqlCleaningWhere: string = '';
  private sqlOrderby: string = '';

  //
  private mapCleaningColumn: Map<string, any> = new Map();

  constructor(columns: string[], inVo: CleaningJobDetailVO, dbtype: HQL_TYPE) {
    let instructions: any = inVo.instructions;
    if (typeof instructions === 'string') {
      instructions = JSON.parse(instructions);
    }
    instructions = plainToClass(CleaningInstruction, instructions);
    this.columns = columns;
    this.strAllColumns = columns.join(',');
    if (dbtype === HQL_TYPE.PRESTO) {
      this.targetTableName = 'hive.default.' + inVo.targetTableName;
    } else {
      this.targetTableName = 'default.' + inVo.targetTableName;
    }

    const arrCleaning: string[] = [];
    const arrSubquery: string[] = [`select row_number() over() as rowno,*,0 as duplicated_flg from ${this.targetTableName}`];
    const has_rowno_indicator: boolean = false;
    const filterRowCondition: string[] = [];

    instructions.forEach((instruction: CleaningInstruction) => {
      const arrDefineMatch: string[] = [];
      instruction.match.forEach((item: CleaningMatch) => {
        arrDefineMatch.push(this.columnExpress(item.columnName) + item.condition);
      });
      const definedMatch: string = arrDefineMatch.join(' and ');

      const arrSelfMatch: string[] = [];

      instruction.process.forEach((process: CleaningProcess) => {
        let columnName: string = process.columnName;
        if (process.processCode === CLEANING_CODE.CLEANING_ROWS_DISTINCT) {
          columnName = 'duplicated_flg';

          arrSubquery.push(`select rowno, ${this.strAllColumns}, if(min(rowno) over (partition by ${this.joinColumns(false)}) != rowno, 1,${columnName}) as ${columnName}  from `);

          if (!filterRowCondition.includes('duplicated_flg != 1')) {
            filterRowCondition.push('duplicated_flg != 1');
          }
        } else if (process.processCode === CLEANING_CODE.CLEANING_ROWS_DELETE) {
          columnName = 'delete_flg';
          filterRowCondition.push('not (' + this.joinCond(definedMatch, ' and ', process.param1) + ')');
        } else if (process.processCode === CLEANING_CODE.CLEANING_VALUE_AVERAGE) {
          arrSubquery.push(`select *, avg(${this.columnExpress(columnName)}) over() as ${columnName}_avg
          from `);
        }

        process.columnExpress = this.columnExpress(columnName);
        const helper: HqlHelper = new HqlHelper(process, this.joinColumns(), dbtype);

        if (helper.selfMatch !== '') {
          arrSelfMatch.push(helper.selfMatch);
        }

        if (definedMatch) {
          this.mapCleaningColumn.set(columnName, `if(${definedMatch}, ${helper.replaceSql}, ${this.columnExpress(columnName)})`);
        } else {
          this.mapCleaningColumn.set(columnName, `${helper.replaceSql}`);
        }
      });

      let selfMatchs: string = arrSelfMatch.join(' or ');
      if (selfMatchs.length > 1) {
        selfMatchs = `(${selfMatchs})`;
      }
      const matchSql: string = this.joinCond(definedMatch, ' and ', selfMatchs);

      if (matchSql.length > 1) {
        arrCleaning.push(matchSql);
      }
    });

    this.sqlSelect = 'select rowno,' + this.joinColumns();
    this.sqlFromClause = `from (${arrSubquery.reverse().join('(')}`;
    for (let i: number = 0; i < arrSubquery.length; i = i + 1) {
      this.sqlFromClause = this.sqlFromClause + `) tmp_table_${i.toString()}`;
    }

    if (arrCleaning.length > 0) {
      this.sqlMartchedWhere = `where (${arrCleaning.join(' or ')})`;
      this.sqlModifiedWhere = this.sqlMartchedWhere;
      if (filterRowCondition.length > 0) {
        this.sqlModifiedWhere = `${this.sqlModifiedWhere} and ${filterRowCondition.join(' and ')}`;
      }
    }
    if (filterRowCondition.length > 0) {
      this.sqlCleaningWhere = `where ${filterRowCondition.join(' and ')}`;
    }
    if (has_rowno_indicator) {
      this.sqlOrderby = 'order by rowno';
    }
  }

  private columnExpress(columnName: string): string {
    let ret: string = columnName;
    if (this.mapCleaningColumn.has(columnName)) {
      ret = this.mapCleaningColumn.get(columnName);
    }
    return ret;
  }

  private joinColumns(hasAlias: boolean = true): string {
    let selectString: string = '';
    for (let i: number = 0; i < this.columns.length; i = i + 1) {
      selectString = selectString + this.columnExpress(this.columns[i]) + (hasAlias ? ' as ' + this.columns[i] : '') + (i === this.columns.length - 1 ? '' : ',');
    }
    return selectString;
  }

  private joinCond(elem1: string, connector: string, elem2: string): string {
    if (elem1 !== '' && elem2 !== '') {
      return `(${elem1}${connector}${elem2})`;
    }
    if (elem1 !== '') {
      return elem1;
    }
    return elem2;
  }

  public matchedSampleSql(): string {
    return `select rowno,${this.strAllColumns} ${this.sqlFromClause} ${this.sqlMartchedWhere}  ${this.sqlOrderby} order by rowno limit 1000`;
  }

  public expectedSampleSql(): string {
    return `${this.sqlSelect} ${this.sqlFromClause} ${this.sqlModifiedWhere} ${this.sqlOrderby} order by rowno limit 1000`;
  }

  public createCleaningSql(outoutTableName: string): string {
    const selectSql: string = `${this.sqlSelect} ${this.sqlFromClause} ${this.sqlCleaningWhere} ${this.sqlOrderby}`;
    return `create table ${outoutTableName} stored as orc AS (${selectSql})`;
  }

  public createMatchedSql(matchedTableName: string): string {
    const selectSql: string = `select ${this.strAllColumns} ${this.sqlFromClause} ${this.sqlMartchedWhere} ${this.sqlOrderby}`;
    return `create table ${matchedTableName} stored as orc AS (${selectSql})`;
  }

  public createModifiedSql(modifiedTableName: string): string {
    const selectSql: string = `${this.sqlSelect} ${this.sqlFromClause} ${this.sqlModifiedWhere} ${this.sqlOrderby}`;
    return `create table ${modifiedTableName} stored as orc AS (${selectSql})`;
  }
}

Object.seal(HqlBuilder);
export default HqlBuilder;
