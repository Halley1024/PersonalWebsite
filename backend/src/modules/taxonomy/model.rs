/// 分类与标签的表名白名单，绝不接受用户输入拼接表名。
pub enum TaxonomyTable {
    Categories,
    Tags,
}
impl From<bool> for TaxonomyTable {
    fn from(tags: bool) -> Self {
        if tags { Self::Tags } else { Self::Categories }
    }
}
impl TaxonomyTable {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Categories => "categories",
            Self::Tags => "tags",
        }
    }
}
